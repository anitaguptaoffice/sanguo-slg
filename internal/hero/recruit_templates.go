package hero

import (
	"context"
	"sort"
)

// RecruitTemplatePreview is one recruitable hero template with cost metadata.
type RecruitTemplatePreview struct {
	Template     Template
	AlreadyOwned bool
}

// ListRecruitTemplatesQuery filters and paginates catalog templates.
type ListRecruitTemplatesQuery struct {
	Pool   string
	Limit  int
	Offset int
}

// ListRecruitTemplatesResult is a page of recruit templates.
type ListRecruitTemplatesResult struct {
	Templates []RecruitTemplatePreview
	Total     int
}

// ListRecruitTemplates returns hero templates from the catalog with ownership hints.
func (s *Service) ListRecruitTemplates(ctx context.Context, p PlayerRef, q ListRecruitTemplatesQuery) (ListRecruitTemplatesResult, error) {
	owned := map[int32]bool{}
	heroes, err := s.Store.ListPlayerHeroes(ctx, p.ServerID, p.PlayerID)
	if err != nil {
		return ListRecruitTemplatesResult{}, err
	}
	for _, h := range heroes {
		if h.Status == StatusCaptive || h.TemplateCfgID == 0 {
			continue
		}
		owned[h.TemplateCfgID] = true
	}
	poolFilter := q.Pool
	var rows []RecruitTemplatePreview
	for id, t := range s.Catalog {
		if poolFilter != "" && t.Pool != poolFilter {
			continue
		}
		rows = append(rows, RecruitTemplatePreview{
			Template:     t,
			AlreadyOwned: owned[id],
		})
	}
	sort.Slice(rows, func(i, j int) bool {
		return rows[i].Template.TemplateCfgID < rows[j].Template.TemplateCfgID
	})
	total := len(rows)
	if q.Offset < 0 {
		q.Offset = 0
	}
	if q.Offset >= total {
		return ListRecruitTemplatesResult{Total: total}, nil
	}
	if q.Limit <= 0 {
		return ListRecruitTemplatesResult{Templates: rows[q.Offset:], Total: total}, nil
	}
	end := q.Offset + q.Limit
	if end > total {
		end = total
	}
	return ListRecruitTemplatesResult{Templates: rows[q.Offset:end], Total: total}, nil
}
