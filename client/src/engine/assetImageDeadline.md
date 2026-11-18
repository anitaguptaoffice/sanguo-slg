# Optional item artwork startup

An exclusively optional `item.icon.<id>.v1` request stops waiting after
15 seconds. Startup can then continue without that decoration. A path used
by a required asset or button state keeps the required-image behavior.

Settlement clears the image handlers and any timer. A timeout also clears
the image source. Late events cannot populate the cache, and a later
explicit load can request the image again.
