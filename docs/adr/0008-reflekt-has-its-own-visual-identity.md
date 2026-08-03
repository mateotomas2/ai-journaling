---
status: accepted
---

# Reflekt looks like a journal, not like the PWA

Reflekt shipped with `ColorScheme.fromSeed` and `useMaterial3: true` as its entire design system, so every screen rendered Material defaults and someone's writing was set in the same type as a settings row. Rather than port the PWA's shadcn palette across, Reflekt gets its own identity — warm paper, a serif reading face for what the *person* wrote against a sans UI face for everything the machine says, generous line-height, restraint over chrome — because the content of this app is prose about someone's life and typography is the only lever that addresses that.

## Considered options

**Port the PWA's identity.** Safe, and it keeps ADR-0001's two clients recognisably one product. Rejected because the PWA's look is close to stock shadcn — reimplementing generic in a second framework spends the work and buys nothing.

**Material You / dynamic colour.** Native, free, obviously correct for Android. Rejected because it hands the palette to the user's wallpaper: a journal that is teal on Tuesday. Dynamic colour suits utilities, not intimate apps.

## Consequences

ADR-0001 says the PWA and Reflekt both ship, so this is a deliberate divergence: the two clients will look like different products until the PWA adopts the same tokens, and it will make the PWA look dated in the meantime. Do not "fix" the divergence by re-aligning Reflekt to the PWA — the direction of travel is the other way.

The serif carries the person's voice and the sans carries the assistant's, in the note list, the composer and the chat alike. Swapping which side gets the serif would follow the ChatGPT/Claude convention and lose the point: this is a journal with an assistant in it, not a chat app with a warm palette.
