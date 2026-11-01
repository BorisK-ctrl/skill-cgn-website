# Resend-Domain skill-studios.com: DNS-Einträge für STRATO

Stand 2026-11-01, abgelesen aus Resend → Domains → skill-studios.com (Region Ireland eu-west-1). Drei Einträge, alle beim Hoster STRATO unter Domain → DNS-Verwaltung. TTL auf Standard lassen.

## 1. DKIM (Domainschlüssel)

| Feld | Wert |
|---|---|
| Typ | TXT |
| Name / Host | `resend._domainkey` |
| Wert | siehe unten, eine Zeile, ohne Umbrüche |

```
p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCuNATjwlJKG+OWTi+5jkdDTZwk1exyl0pI8Fu7ovidGIxZC2DMYLixJwgmO6BDt7kqZfgwvhUMukTQ2wv3MbeyFpu4WlSIzPUtTwijfA1GGQKu/q87D55jW46xXBew0UtmjrGIueXWLqo9B0Vxd+3qfHq7PERMRp51MiBGZnqiyQIDAQAB
```

## 2. Rückläufer (MX auf der Subdomain send)

| Feld | Wert |
|---|---|
| Typ | MX |
| Name / Host | `send` |
| Ziel | `feedback-smtp.eu-west-1.amazonses.com` |
| Priorität | 10 |

## 3. SPF (TXT auf der Subdomain send)

| Feld | Wert |
|---|---|
| Typ | TXT |
| Name / Host | `send` |
| Wert | `v=spf1 include:amazonses.com ~all` |

## Nicht eintragen

- Den Eintrag unter „Enable receiving“ (MX `@` → inbound-smtp.eu-west-1.amazonaws.com) **nicht** anlegen. Er würde den gesamten Mailempfang von skill-studios.com von Google weg zu Amazon leiten.
- Der bestehende DMARC-Eintrag `_dmarc` (v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com) bleibt, wie er ist.

## Hinweise für STRATO

- Bei STRATO legt man für `send` und `resend._domainkey` zuerst je eine Subdomain an und setzt dann die Einträge auf dieser Subdomain. Erscheint als Host-Feld die komplette Form, lautet sie `send.skill-studios.com` bzw. `resend._domainkey.skill-studios.com`.
- Nach dem Speichern in Resend auf „Verify DNS records“ klicken. Prüfung dauert meist wenige Minuten bis eine Stunde.
- Prüfen von außen: `dig +short TXT resend._domainkey.skill-studios.com` muss den Wert aus Schritt 1 zeigen.

Sobald der Status „Verified“ ist, gehen Willkommens- und Kaufbestätigungen an alle Kunden raus (Absender buchung@ und info@skill-studios.com). Bis dahin erreicht nur die Team-Mail an info@ ihr Ziel.
