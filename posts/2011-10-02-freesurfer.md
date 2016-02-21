---
author: Spencer Boucher
date: 2011-10-02
layout: post
summary:
title: Freesurfer
---

Today, two of my housemates and I were sitting around at the living room table
when the topic of Foldit came up. [Foldit][], if you aren’t aware is a platform
that has been developed at the University of Washington jointly between the
departments of Computer Science and Biochemistry. It is remarkable in that it
solves a major research problem in a completely novel and intriguing way.

![FoldIt]({{ site.url }}/images/foldit.jpg)

Protein folding is massively complex. Sure, we can work out the genetic code for
a particular protein lickity-split, but the factors that go into determining how
that chain of amino acids actually *folds* upon itself and forms secondary /
tertiary structures are so numerous that its a problem computers can’t
solve. Brute force just won’t cut it. What we need is the ability to recognize
*patterns,*and that is something humans are still *much* better at than a
computer. (Computers, in their present form, may not *ever* be able to match us
in this regard- at least in their present form. More on this in a future blog
post potentially.) So the solution? Draft huge numbers of humans to do the job,
and do it by turning the puzzle problem into a game. The effort has already been
hugely successful. You can see the game GUI in the picture above.

I must have mentioned something about how I wished I could crowd source
time-consuming aspects of the processing pipeline in our neuroimaging resource,
because Harvey’s (I’ve decided to use first names) response was: “why not?”
Harvey is a hard-core entrepreneur, in a way that I never have been but is
nonetheless infectious. He will be a multimillionaire one day- there is no doubt
in my mind. Before I knew it, he had index cards strewn over the table and was
outlining a process chart for how such a system would work for structural
analysis of brain MRI data using Freesurfer. So we now have a
workflow-comparison of the present pre-processing pipeline, side by side with an
idea of how it could theoretically be better.

![Pre-Freesurfer]({{ site.url }}/images/coronal.jpg)

Freesurfer takes MRI images that are composed of many brain “slices”
(see above) and turns them into surface/volume models that look like
this:

![Post-Freesurfer]({{ site.url }}/images/freesurf.jpg)

From there, you can analyze changes in volume and whatnot from individual to
individual or from time A to time B. I won’t get into it here, but its really
neat stuff.

Freesurfer is computation-heavy. Multiple steps in the pipeline take 12 or more
hours to run. I have 16 servers on my computer in the lab, and when I recruit
other processors from around the lab I can get up to 50 or even 100 of these
processes running in parallel. After the computer’s algorithms have their crack
at the raw data, human quality-checking is necessary because many manual edits
typically need to be performed. This can be very time intensive- as I have
discovered since beginning work here- with very large data sets. You need to
edit the computer’s output, and then re-run another time-intensive process to
actually apply those edits. This is an iterative process until the output is
deemed acceptable upon visual inspection.

Apparently, online platforms for splitting up work that only a human can do
already exists online. Check out the Mechanical Turk at mturk.com. What if a
system could be designed to crowd-source such steps in the pre-processing
pipeline. The necessary cloud-computing infrastructure seems to already exist as
well- in the form of Amazon’s elastic compute cloud. It seems- from a scan of
the Freesurfer listserv- that Freesurfer has already been run successfully on
these servers by other researchers. So the theory is that a cloud-computing web
platform could parcel out units of work via mturk (or something similar) and
rapidly accomplish steps that otherwise can’t be performed in parallel by one
researcher.

There’s lots of problems with the idea. Foldit has the inherit benefit of being
very puzzle-like, which means there’s a built in game aspect and a sense of
discovery. Freesurfer does not have this (its rather monotonous). There could
conceivably be a way to gameify it with the right interface, however. There’s
also always the possibility of paying for the units of work performed.

The units of work themselves also pose a problem. A single brain is typically
composed of roughly 124 individual “slices”. These would seem to be convenient
units to split into, except that one does not edit a freesurfer slice
independently of all others. Surrounding slices often inform the anatomy of a
slice in question. So maybe hemispheres of the brain could be a useful
unit. This, however, is a much larger unit (2 per brain vs. 124 per brain).

The researcher would still have to do a final QC of the data that the crowd
edits, of course. But maybe it could make things more efficient. Even if it
wouldn’t work for Freesurfer, the possibility of applying the “Foldit” technique
to other fields of study is very intriguing. The key ingredient that is probably
missing from this particular instance is a goal-oriented, success-driven
component to the activity.

If you are a scientist reading this post, I’d love to hear your ideas for other
tasks found in your research pipeline that could be game-ified and crowdsourced!
Leave a comment!

[Foldit]: http://fold.it
