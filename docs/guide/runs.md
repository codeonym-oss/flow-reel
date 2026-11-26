# Runs

Every compose is a **run**. It goes through five **phases**: it records the script, speaks the comments, plans the
timeline, renders the video and publishes the reel. It has its own process, so it goes on when the terminal that
started it closes.

```sh
npx flow-reel compose reels/settings.reel.ts             # shows the run until its reel is there
npx flow-reel compose reels/settings.reel.ts --detach    # starts it and returns
```

A run works on its own copy of the scripts folder. You can change a script while it composes: the run keeps the one it
started with.

## Name a run

| Name | Means |
|---|---|
| `settings` | the script's latest run in this workspace |
| `12` | run 12 of this workspace |
| `shop/12` | run 12 of the workspace `shop`, from any folder |

`cancel` and `resume` change a run. When a script's name fits several, they refuse and list them.

## Watch, wait and cancel

```sh
npx flow-reel watch settings     # shows it to its end; Ctrl+C only stops watching
npx flow-reel wait settings      # says nothing; the exit code says how it ended
npx flow-reel logs settings      # what the script, the browser and the renderer printed
npx flow-reel cancel settings    # ends it, and its container
```

Ctrl+C in a plain `compose` cancels its run. Pressed again, it leaves without waiting. A cancelled run leaves the
project as it was.

## Resume a run

A run that **stopped** (its process was killed, the computer went off) or **failed** (the voice refused, a phase took
too long) keeps what it finished:

```sh
npx flow-reel resume settings
```

It goes on from the phase that was cut off, with the scripts and settings it started with. What is finished is checked
first, and made again if a file changed.

**A recording is never repeated by itself**, because your script may have changed data in the app. If the recording is
missing, `resume` refuses, and says which `compose` starts a new run.

## Several runs at once

A recording, a render and the local voice each need most of a computer, so runs take turns at them, in the order they
asked. A waiting run says which one it is behind. Cloud voices don't wait.

Two runs of one script publish in the order they were started: an older run never replaces a newer one's reel. It is
done all the same, and says where its own reel is.

## Time limits

A phase that hangs ends with its limit's name. The defaults are 60 minutes for recording, 60 for voicing and 120 for
rendering. Change them in `flow-reel.json`:

```json
{
  // ...
  "limits": { "record": 20, "voice": 90 }
}
```

## The history

```sh
npx flow-reel runs           # this workspace's runs, and what can be done with each
npx flow-reel runs --all     # every workspace's on this computer
```

A run's journal and log are kept. Its **heavy files** (the recording, the clips, the video) are kept for the last five
finished runs of each script; `keepRuns` in `flow-reel.json` changes the number. A run that is going, or can go on, is
never trimmed.

`npx flow-reel clean` removes every finished run's heavy files. It shows them and asks first; in CI, pass `--yes`.

## Where runs are

Nothing of a run is in your project but its finished reel. Runs are in flow-reel's **data folder**:

| System | Folder |
|---|---|
| Linux | `~/.local/share/flow-reel` (`$XDG_DATA_HOME/flow-reel`) |
| macOS | `~/Library/Application Support/flow-reel` |
| Windows | `%LOCALAPPDATA%\flow-reel` |

`FLOW_REEL_DATA_DIR` names another one. Deleting the folder removes every run, and nothing else.
