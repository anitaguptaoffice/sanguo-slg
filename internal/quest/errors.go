package quest

import "errors"

var (
	ErrQuestNotFound           = errors.New("quest: not found")
	ErrPrerequisiteNotMet      = errors.New("quest: prerequisite not met")
	ErrAlreadyAccepted         = errors.New("quest: already accepted")
	ErrNotInProgress           = errors.New("quest: not in progress")
	ErrProgressInvalid         = errors.New("quest: progress invalid")
	ErrNotClaimable            = errors.New("quest: not claimable")
	ErrAlreadyCompleted        = errors.New("quest: already completed")
	ErrChainLocked             = errors.New("quest: chain locked")
	ErrLevelTooLow             = errors.New("quest: player level too low")
	ErrGrantFailed             = errors.New("quest: reward grant failed")
)
