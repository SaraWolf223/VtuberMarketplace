# Local Marketplace — UI/UX Design System

**Version:** 1.0  
**Vibe:** Fast, local, treasure-hunt — not corporate marketplace gray

---

## 1. Brand

| Element | Value |
|---------|-------|
| App name | Local Marketplace |
| Tagline | "Cheap finds, near you." |
| Personality | Energetic, bargain-friendly, trustworthy |

---

## 2. Color tokens

Implement in `src/theme/tokens.ts`:

**Vibe:** Silicon Valley tech — clean white surfaces, black type, electric blue accents. OfferUp-style feed layout unchanged.

```typescript
export const colors = {
  primary: '#0066FF',
  primaryDark: '#0052CC',
  accent: '#0066FF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0A0A0F',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  price: '#0066FF',
  priceBackground: '#EFF6FF',
  premium: '#1E40AF',
  highlightBoostFree: '#93C5FD',   // regular boost border
  highlightPremiumBoost: '#1E3A8A', // premium boost border
  highlightPremium: '#3B82F6',
};
```

**Dark mode:** User-selectable in Settings → Appearance (Light / Dark). Default: **Light**. Stored in AsyncStorage (`localmarketplace-theme`).

---

## 3. Typography

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `hero` | 28 | 700 | Onboarding titles |
| `h1` | 22 | 700 | Screen titles |
| `h2` | 18 | 600 | Section headers |
| `body` | 16 | 400 | Descriptions |
| `caption` | 13 | 400 | Distance, time ago |
| `price` | 24 | 800 | Listing price |
| `priceSm` | 18 | 700 | Card price |

**Font:** System default (San Francisco / Roboto) — no custom font MVP.

---

## 4. Spacing scale

`4, 8, 12, 16, 20, 24, 32` — use multiples of 4 only.

| Token | px |
|-------|-----|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 16 |
| `lg` | 24 |
| `xl` | 32 |

---

## 5. Radius & elevation

| Token | Value |
|-------|-------|
| `radiusSm` | 8 |
| `radiusMd` | 12 |
| `radiusLg` | 16 |
| `radiusFull` | 999 |

**Shadow (cards):** iOS shadowOpacity 0.08, elevation 2 Android.

---

## 6. Components

### 6.1 Button

| Variant | Style |
|---------|-------|
| `primary` | Green fill, white text |
| `secondary` | White fill, green border |
| `ghost` | Transparent, green text |
| `danger` | Red fill |

Height: 48px min. Border radius: `radiusMd`.

### 6.2 ListingCard (feed)

```
┌─────────────────────────────┐
│  [Image 4:3 thumb]     ♡     │
│  ┌ BOOSTED ─┐  (if boosted) │
├─────────────────────────────┤
│  $15.00          2.3 mi     │
│  PS4 controller             │
│  Gaming · 2h ago            │
└─────────────────────────────┘
```

- Thumb: full width, aspect ratio 4:3
- Price: top-left overlay OR row below image (choose one — **use row below for readability**)
- Boost ribbon: amber, top-left on image
- Sold: grayscale overlay + "SOLD" badge

### 6.3 Price display

- Always prefix `$`
- Two decimal places only if non-integer (`$15` vs `$15.50`)
- Max visual emphasis on detail screen

### 6.4 Category chip

- Icon + label, `surface` background, `radiusFull` padding horizontal 12

### 6.5 Filter bar

- Horizontal `ScrollView` chips
- Selected: `primary` fill; unselected: `border` outline

### 6.6 Empty feed illustration

- Simple line art treasure box
- Copy: "No treasures nearby yet"
- Sub: "Try 25 mi radius or post the first deal"

### 6.7 Premium badge

- Purple checkmark + "Premium" on profile and cards (small)

### 6.8 Boost CTA

- Amber lightning icon + "Boost for $1"

---

## 7. Icons

Use `@expo/vector-icons` / `lucide-react-native`:

| Concept | Icon |
|---------|------|
| Home | home |
| Sell | plus-circle |
| Favorites | heart |
| Profile | user |
| Distance | map-pin |
| Boost | zap |
| Report | flag |

---

## 8. Motion

- Screen transitions: default stack
- Favorite heart: scale 1 → 1.2 → 1 (150ms)
- Pull-to-refresh: native
- **No** heavy animations MVP

---

## 9. Accessibility

- Contrast ratio ≥ 4.5:1 for body text
- Price not color-only — include `$` symbol
- `accessibilityRole="button"` on cards → navigate to detail

---

## 10. Copy guidelines

| Context | Tone |
|---------|------|
| Errors | Short, friendly |
| Empty states | Encouraging |
| Safety | Direct, not alarmist |
| Premium | Value-focused, not pushy |

**Examples:**

- "Sort by lowest price to find the best deals."
- "Meet in a public place. Skip deposits."
- "Boost puts you on top nearby for 24 hours."

---

## 11. Onboarding visuals

- Slide backgrounds: light green tint `#F0FDF4`
- Large emoji or simple SVG per slide

---

## 12. Ad placement visual

- Banner height 50px
- Divider line above ad slot
- Label optional "Sponsored" small muted

---

## 13. Screen wireframe references

**Feed:** Header (ZIP + radius tap) → Filters → List  
**Detail:** Carousel → Info block → Seller → Sticky bottom bar (Contact, Favorite)  
**Sell:** Progress dots 1/4 → content → Next CTA fixed bottom

---

## 14. Do / Don't

| Do | Don't |
|----|-------|
| Big readable prices | Tiny gray prices |
| Show distance on every card | Hide location context |
| Big, clear price display | Bury the price in fine print |
| Consistent card layout | Mixed grid sizes MVP |
