package security

import "testing"

func TestHashAndVerify(t *testing.T) {
	hash, err := HashPassword("Demo12345")
	if err != nil {
		t.Fatalf("hash failed: %v", err)
	}
	if !VerifyPassword(hash, "Demo12345") {
		t.Fatal("expected password to verify")
	}
	if VerifyPassword(hash, "WrongPass1") {
		t.Fatal("expected wrong password to fail")
	}
	if VerifyPassword("not-a-hash", "Demo12345") {
		t.Fatal("expected malformed hash to fail")
	}
}

func TestShortPasswordRejected(t *testing.T) {
	if _, err := HashPassword("short"); err == nil {
		t.Fatal("expected short password to be rejected")
	}
}

func TestHashesAreSalted(t *testing.T) {
	h1, _ := HashPassword("Demo12345")
	h2, _ := HashPassword("Demo12345")
	if h1 == h2 {
		t.Fatal("expected distinct salts to produce distinct hashes")
	}
}
