package content

import "errors"

var (
	ErrUnknownItem       = errors.New("content: unknown item_cfg_id")
	ErrInvalidQuantity   = errors.New("content: quantity must be positive")
	ErrStackLimit        = errors.New("content: exceeds max stack")
	ErrBagFull           = errors.New("content: bag distinct-item capacity reached")
	ErrInsufficientItems = errors.New("content: insufficient item quantity")
	ErrNotConsumable     = errors.New("content: item is not consumable")
	ErrUnsupportedUse    = errors.New("content: consumable use not supported for item type")
)
