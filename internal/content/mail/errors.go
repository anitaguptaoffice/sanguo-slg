package mail

import "errors"

var (
	ErrNotFound        = errors.New("mail: not found")
	ErrForbidden       = errors.New("mail: forbidden")
	ErrNoAttachments   = errors.New("mail: no attachments")
	ErrAlreadyDeleted  = errors.New("mail: deleted")
	ErrContentRequired = errors.New("mail: content grant service not configured")
)
