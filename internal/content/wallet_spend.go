package content

import "errors"

// ErrInsufficientWallet is returned when SpendWallet cannot debit the requested amounts.
var ErrInsufficientWallet = errors.New("content: insufficient wallet balance")

// SpendWallet debits resources from the in-memory player wallet (PG path uses shop wallet in api).
func (s *Service) SpendWallet(p PlayerRef, cost ResourceWallet) error {
	if cost.Food == 0 && cost.Wood == 0 && cost.Iron == 0 && cost.Stone == 0 && cost.Gold == 0 {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	have := s.walletFor(p)
	if have.Food < cost.Food || have.Wood < cost.Wood || have.Iron < cost.Iron ||
		have.Stone < cost.Stone || have.Gold < cost.Gold {
		return ErrInsufficientWallet
	}
	have.Food -= cost.Food
	have.Wood -= cost.Wood
	have.Iron -= cost.Iron
	have.Stone -= cost.Stone
	have.Gold -= cost.Gold
	s.wallets[p] = have
	return nil
}
