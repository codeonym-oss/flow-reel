# The studio answers while a run's image is pulled or built

Found while building GH-140 (decided alone: the person approved autonomous delivery of story GH-109).

**Before:** Run, Resume and Run again on save make sure the composer image is on the computer before a run starts
(GH-136 decision 003). `ensureImage` pulled or built it with `spawnSync`, in the studio's own process, so for the
minutes a first pull or build takes the studio answered nothing: pages stopped updating and said the studio had
stopped. GH-136's risks assumed only the Run button would wait.

**Now:** the image check runs its engine commands without holding up the process. The Run button still waits for its
answer until the run has started; everything else keeps working meanwhile. `compose` and `resume` behave as before.
