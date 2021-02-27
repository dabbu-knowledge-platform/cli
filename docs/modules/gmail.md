---
layout: home
title: Gmail
nav_order: 7
parent: Provider Modules
---

# Gmail

Allows you to list, read and delete threads with a certain label.

Labels are treated as folders. Multiple labels can be specified (separated by commas) to search for threads with all the mentioned labels.

Threads are treated as files. The thread ID is used to get a thread and all its messages.

When getting a specific thread, the provider will create a zip file containing all messages in the thread, along with any inline images and attachments. The messages will be converted to markdown if in html.

Creating (creating a thread) and updating (replying to a thread) threads is not yet supported.
