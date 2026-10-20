package model

import (
	"reflect"
	"strings"
	"testing"
)

func filterIDs(cards []*Card) []string {
	ids := make([]string, len(cards))
	for i, c := range cards {
		ids[i] = c.ID
	}
	return ids
}

func TestParseFieldFilters_Errors(t *testing.T) {
	board := sortTestBoard()
	tests := []struct {
		name    string
		raw     string
		wantErr string
	}{
		{"missing equals", "priority", "expected key=value"},
		{"unknown field lists valid ones", "bogus=1", "valid fields: assignee, blocked, due, labels, priority, topics"},
		{"bad boolean", "blocked=maybe", "must be one of: true, false"},
		{"unknown enum option", "priority=hihg", `"hihg" is not a valid option`},
		{"unknown enum-set option", "labels=blocked,nope", `"nope" is not a valid option`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ParseFieldFilters([]string{tt.raw}, board)
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("ParseFieldFilters(%q) error = %v, want containing %q", tt.raw, err, tt.wantErr)
			}
		})
	}
}

func TestParseFieldFilters_FreeSetAcceptsAnyValue(t *testing.T) {
	if _, err := ParseFieldFilters([]string{"topics=anything"}, sortTestBoard()); err != nil {
		t.Fatalf("free-set filter should not validate options: %v", err)
	}
}

func TestFilterCards_Fields(t *testing.T) {
	cards := []*Card{
		mkCard("a", "a0", map[string]any{"priority": "high", "blocked": true, "labels": []any{"blocked", "needs-review"}, "assignee": "sam"}),
		mkCard("b", "a1", map[string]any{"priority": "low", "blocked": false, "labels": []any{"blocked"}}),
		mkCard("c", "a2", map[string]any{"topics": []string{"go", "cli"}, "due": "2026-10-20"}),
		mkCard("d", "a3", nil),
	}

	tests := []struct {
		name string
		raw  []string
		want []string
	}{
		{"enum equality", []string{"priority=high"}, []string{"a"}},
		{"boolean true", []string{"blocked=true"}, []string{"a"}},
		{"boolean false includes unset", []string{"blocked=no"}, []string{"b", "c", "d"}},
		{"enum-set contains", []string{"labels=blocked"}, []string{"a", "b"}},
		{"enum-set comma means all", []string{"labels=blocked,needs-review"}, []string{"a"}},
		{"repeated flag means all", []string{"labels=blocked", "labels=needs-review"}, []string{"a"}},
		{"free-set contains", []string{"topics=cli"}, []string{"c"}},
		{"string equality", []string{"assignee=sam"}, []string{"a"}},
		{"date equality", []string{"due=2026-10-20"}, []string{"c"}},
		{"different fields all match", []string{"labels=blocked", "priority=low"}, []string{"b"}},
		{"empty value matches unset", []string{"priority="}, []string{"c", "d"}},
		{"no match", []string{"assignee=nobody"}, []string{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filters, err := ParseFieldFilters(tt.raw, sortTestBoard())
			if err != nil {
				t.Fatalf("ParseFieldFilters: %v", err)
			}
			got := filterIDs(FilterCards(cards, nil, filters))
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("FilterCards(%v) = %v, want %v", tt.raw, got, tt.want)
			}
		})
	}
}

func TestFilterCards_Search(t *testing.T) {
	cards := []*Card{
		{ID: "a", Title: "Fix WhatsApp inbox", Description: "Refund flow breaks"},
		{ID: "b", Title: "Refund policy", Description: "Nothing about messaging"},
		{ID: "c", Title: "Unrelated", Description: "", Comments: []Comment{{Body: "whatsapp"}}},
	}

	tests := []struct {
		query string
		want  []string
	}{
		{"whatsapp", []string{"a"}}, // comments are not searched
		{"REFUND", []string{"a", "b"}},
		{"whatsapp refund", []string{"a"}}, // words may be split across title and description
		{"refund messaging", []string{"b"}},
		{"refund missing", []string{}},
		{"   ", []string{"a", "b", "c"}},
	}
	for _, tt := range tests {
		t.Run(tt.query, func(t *testing.T) {
			got := filterIDs(FilterCards(cards, SearchWords(tt.query), nil))
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("search %q = %v, want %v", tt.query, got, tt.want)
			}
		})
	}
}

func TestFilterCards_SearchAndFieldsCombine(t *testing.T) {
	cards := []*Card{
		mkCard("a", "a0", map[string]any{"priority": "high"}),
		mkCard("b", "a1", map[string]any{"priority": "low"}),
	}
	cards[0].Title = "billing export"
	cards[1].Title = "billing import"

	filters, err := ParseFieldFilters([]string{"priority=low"}, sortTestBoard())
	if err != nil {
		t.Fatal(err)
	}
	got := filterIDs(FilterCards(cards, SearchWords("billing"), filters))
	if !reflect.DeepEqual(got, []string{"b"}) {
		t.Errorf("got %v, want [b]", got)
	}
}
