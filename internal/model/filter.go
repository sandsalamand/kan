package model

import (
	"fmt"
	"sort"
	"strings"
)

// ParseBool parses a custom-field boolean value.
// Accepts true/false, yes/no, 1/0 (case-insensitive).
func ParseBool(s string) (bool, error) {
	switch strings.ToLower(s) {
	case "true", "yes", "1":
		return true, nil
	case "false", "no", "0":
		return false, nil
	default:
		return false, fmt.Errorf("must be one of: true, false, yes, no, 1, 0")
	}
}

// FieldFilter is one parsed `key=value` condition from `kan list -f`.
type FieldFilter struct {
	Name   string
	Type   string
	Value  string   // string, enum, date: the value to compare for equality
	Bool   bool     // boolean: the wanted value (unset counts as false)
	Values []string // enum-set, free-set: values the card's set must all contain
}

// ParseFieldFilters parses `key=value` strings (the `kan add -f` syntax) into
// filters against the board's custom fields. Every filter must match for a
// card to pass. An unknown field name, a non-boolean value for a boolean field,
// or an unknown option for an enum/enum-set field is an error, so a typo fails
// loudly instead of silently matching nothing. An empty value matches cards
// that have the field unset.
func ParseFieldFilters(raw []string, boardCfg *BoardConfig) ([]FieldFilter, error) {
	filters := make([]FieldFilter, 0, len(raw))
	for _, f := range raw {
		parts := strings.SplitN(f, "=", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid field filter %q (expected key=value)", f)
		}
		name := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		schema, ok := boardCfg.CustomFields[name]
		if !ok {
			return nil, fmt.Errorf("unknown field %q; valid fields: %s", name, CustomFieldNames(boardCfg))
		}

		filter := FieldFilter{Name: name, Type: schema.Type, Value: value}
		if value == "" {
			filters = append(filters, filter)
			continue
		}

		switch schema.Type {
		case FieldTypeBoolean:
			b, err := ParseBool(value)
			if err != nil {
				return nil, fmt.Errorf("field %q: %w", name, err)
			}
			filter.Bool = b
		case FieldTypeEnumSet, FieldTypeFreeSet:
			for _, v := range strings.Split(value, ",") {
				if v = strings.TrimSpace(v); v != "" {
					filter.Values = append(filter.Values, v)
				}
			}
		}

		if schema.Type == FieldTypeEnum || schema.Type == FieldTypeEnumSet {
			wanted := filter.Values
			if schema.Type == FieldTypeEnum {
				wanted = []string{value}
			}
			ranks := optionRanks(schema)
			for _, v := range wanted {
				if _, ok := ranks[v]; !ok {
					return nil, fmt.Errorf("field %q: %q is not a valid option; must be one of: %s",
						name, v, optionValues(schema))
				}
			}
		}

		filters = append(filters, filter)
	}
	return filters, nil
}

// Matches reports whether the card satisfies this filter.
func (f FieldFilter) Matches(card *Card) bool {
	val, set := card.CustomFields[f.Name]
	if f.Value == "" {
		return !set || isUnsetValue(val)
	}

	switch f.Type {
	case FieldTypeBoolean:
		return asBool(val) == f.Bool
	case FieldTypeEnumSet, FieldTypeFreeSet:
		have := asStringSlice(val)
		for _, want := range f.Values {
			found := false
			for _, h := range have {
				if h == want {
					found = true
					break
				}
			}
			if !found {
				return false
			}
		}
		return true
	default: // string, enum, date
		return asString(val) == f.Value
	}
}

// SearchWords splits a `kan list --search` query into lowercased words.
func SearchWords(query string) []string {
	return strings.Fields(strings.ToLower(query))
}

// MatchesSearch reports whether every word appears, case-insensitively, in the
// card's title or description. Comments are not searched. Words must already be
// lowercased (see SearchWords).
func MatchesSearch(card *Card, words []string) bool {
	if len(words) == 0 {
		return true
	}
	title := strings.ToLower(card.Title)
	description := strings.ToLower(card.Description)
	for _, w := range words {
		if !strings.Contains(title, w) && !strings.Contains(description, w) {
			return false
		}
	}
	return true
}

// FilterCards returns the cards that match every search word and every field
// filter, preserving their order.
func FilterCards(cards []*Card, words []string, filters []FieldFilter) []*Card {
	if len(words) == 0 && len(filters) == 0 {
		return cards
	}
	result := make([]*Card, 0, len(cards))
	for _, card := range cards {
		if !MatchesSearch(card, words) {
			continue
		}
		matched := true
		for _, f := range filters {
			if !f.Matches(card) {
				matched = false
				break
			}
		}
		if matched {
			result = append(result, card)
		}
	}
	return result
}

func isUnsetValue(v any) bool {
	switch s := v.(type) {
	case nil:
		return true
	case string:
		return s == ""
	case []string:
		return len(s) == 0
	case []any:
		return len(s) == 0
	default:
		return false
	}
}

// CustomFieldNames returns the board's custom field names, sorted, joined for
// display in error messages.
func CustomFieldNames(boardCfg *BoardConfig) string {
	names := make([]string, 0, len(boardCfg.CustomFields))
	for name := range boardCfg.CustomFields {
		names = append(names, name)
	}
	if len(names) == 0 {
		return "(none defined)"
	}
	sort.Strings(names)
	return strings.Join(names, ", ")
}

func optionValues(schema CustomFieldSchema) string {
	values := make([]string, len(schema.Options))
	for i, opt := range schema.Options {
		values[i] = opt.Value
	}
	return strings.Join(values, ", ")
}
