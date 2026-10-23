package content

// ResourceWallet mirrors player_wallet fields used in reward JSON (see spec/rules/content.md).
type ResourceWallet struct {
	Food  int64
	Wood  int64
	Iron  int64
	Stone int64
	Gold  int64
}

func (w *ResourceWallet) credit(delta ResourceWallet) {
	w.Food += delta.Food
	w.Wood += delta.Wood
	w.Iron += delta.Iron
	w.Stone += delta.Stone
	w.Gold += delta.Gold
}

// Wallet returns the player's resource wallet (zeros if never credited).
func (s *Service) Wallet(p PlayerRef) ResourceWallet {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.walletFor(p)
}

func (s *Service) walletFor(p PlayerRef) ResourceWallet {
	if w, ok := s.wallets[p]; ok {
		return w
	}
	return ResourceWallet{}
}

func (s *Service) creditWallet(p PlayerRef, delta ResourceWallet) {
	w := s.walletFor(p)
	w.credit(delta)
	s.wallets[p] = w
}
