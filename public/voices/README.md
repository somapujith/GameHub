# Voices in Hyderabad Tycoon: how it works and how to add real audio

You do not need to be a developer to use this guide. You only need to copy a few files and edit one
small text file.

## What the game does today

Every voice line in the game (for example "Bought the plot!" or the tile comments) is a short piece of text
spoken in the style of a Telugu film hero. When a line should play, the app does this, in order:

1. **Audio clip, if you have added one.** If the line is listed in `manifest.json`, the game plays that
   `.mp3` file.
2. **Otherwise: subtitles plus the phone's Telugu voice.** The line appears as a big Telugu subtitle
   (with an English-letter version and an English meaning, depending on the Subtitles setting), and the
   phone or browser reads it aloud using its built-in Telugu text-to-speech if it has one.
3. **If the device has no Telugu voice**, the game still shows the subtitle on screen for a few seconds and
   carries on. Nothing breaks.

So the game works fully with an empty `manifest.json`. Audio clips are optional.

## Only use audio you have the right to use

Put a clip here **only if you own it or have written permission to use it**, for example:

- a recording of yourself or a friend (with their consent),
- a voice actor you have hired and who has signed a release,
- royalty-free audio whose licence allows use in a game.

**Do not** copy clips from films, songs, YouTube, reels or voice-cloning tools that imitate a real actor.
The lines in the game are original and affectionate fan-made flavour. They are not real film dialogue, and
the game never claims that any real actor actually said them.

### Licensing risk if you ever publish the game

Using the real voice, name, face or style of a living actor in a published or paid game can break
personality, publicity and copyright rights. Even a sound-alike or an AI voice clone can cause legal
trouble. This applies to the app stores, social media promotion and any website, and fan-project status
does not protect you. Before releasing anywhere public, either get written permission from every actor
(and their management) or replace the actor names and voices with your own fictional characters and
original voice actors. If in doubt, ask a lawyer. Nothing in this repository is legal advice.

## Where files go

Every clip lives in a folder named after the actor, and the file is named after the line:

```
public/voices/<actorId>/<lineId>.mp3
```

Example: `public/voices/balakrishna/bk_buy_2.mp3`

The twelve actor ids are: `balakrishna`, `chiranjeevi`, `pawankalyan`, `maheshbabu`, `alluarjun`,
`prabhas`, `ntr`, `ramcharan`, `nagarjuna`, `venkatesh`, `raviteja`, `brahmanandam`.

## How line ids work

Each line has a unique id: `<actor code>_<what happened>_<number>`.

| Code | Actor id | Code | Actor id |
|---|---|---|---|
| `bk` | balakrishna | `nt` | ntr |
| `ch` | chiranjeevi | `rc` | ramcharan |
| `pk` | pawankalyan | `ng` | nagarjuna |
| `mb` | maheshbabu | `vk` | venkatesh |
| `aa` | alluarjun | `rt` | raviteja |
| `pr` | prabhas | `bm` | brahmanandam |

The middle part says when the line plays:

- **Events** use the name of the moment: `bk_buy_2` (line 2 for "player bought a property"),
  `bm_bankrupt_1`, `vk_win_me_6`, and also the emote buttons such as `rt_emote_taunt_1`.
- **Board tiles** use the tile number: `bk_t27_1` (Balakrishna, tile 27 = Banjara Hills, line 1).

The exact text of every line, with its id, is in these two files (open them in any text editor):

- `src/data/voices.events.js` for game events and emotes
- `src/data/voices.tiles.js` for the 28 board tiles

Search for the id (for example `bk_buy_2`) to see what the actor should say, then record that sentence.
Please do not change an id once you have recorded a clip for it. If you want new lines, add them with a
new number.

## How to register a clip: step by step

1. Record or obtain the audio (rights-cleared, see above) and save it as an `.mp3`.
   Short is best: 2 to 5 seconds per line.
2. Name the file exactly as the line id, for example `bk_buy_2.mp3`.
3. Put it in the actor's folder, for example `public/voices/balakrishna/bk_buy_2.mp3`
   (create the folder if it does not exist yet).
4. Open `public/voices/manifest.json` and add one entry per clip. The left side is the line id, the right
   side is the path **inside** the `voices` folder:

```json
{
  "bk_buy_2": "balakrishna/bk_buy_2.mp3",
  "bk_t27_1": "balakrishna/bk_t27_1.mp3",
  "bm_bankrupt_1": "brahmanandam/bm_bankrupt_1.mp3"
}
```

   Rules for this file: it is plain JSON, so every entry is in double quotes, entries are separated by a
   comma, and there is **no comma after the last entry**. An empty file is just `{}`.
5. Save, reload the game (or redeploy). That line now plays the clip. Lines without an entry keep using
   subtitles plus text-to-speech, so you can add clips one by one over time.

## Troubleshooting

- **A clip does not play:** check that the id in `manifest.json` matches the line id letter for letter,
  that the file is really at the path you wrote, and that the JSON has no missing or extra commas.
- **The whole manifest stops working:** this almost always means a JSON typo. Paste the file into any
  online "JSON validator" to find it.
- **No sound at all:** check the Voice and Sound switches in the in-game menu, and the phone volume. On
  phones, the browser only allows sound after the first tap.
- **Telugu text is read oddly or silently:** the phone may not have a Telugu voice installed. In the
  phone's settings, look for "Text-to-speech" and download Telugu. The subtitles still show either way.
- **File size:** keep each clip small (mono, around 64 kbps is plenty), so that the game loads quickly on
  mobile data.
