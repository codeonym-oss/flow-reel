# The queue: one heavy work lock, and reels in order

## Problem

A render beside a recording makes the recording fall behind and fail, and two runs of one script can publish in the wrong
order.

## Change

- **The heavy work lock** (009): recordings, renders and local voices take turns on a computer, first come first served, by
  the order they asked. A dead holder or waiter is skipped at once. A cloud voice doesn't wait.
- **Waiting is shown:** what a run waits for, and behind which run.
- **Publishing in order** (010).

## Done when

- Three runs started together never overlap heavy work, and take turns in order.
- Killing the holder lets the next one go on.
- A cancelled waiter leaves the queue.
- An older run never replaces a newer run's reel, and says where its own is.
