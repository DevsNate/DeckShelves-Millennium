# ADR 0001: Preserve Steam-native controller navigation

Status: Accepted

Deck Shelves carousels are peers in Steam's native GamepadNav hierarchy. The
Millennium port supplies stable navigation keys and current `row`/`column`
flow values, but does not globally intercept D-pad movement.

Steam owns movement, scrolling, and focus restoration. DOM or navigation-tree
patches are narrow, reversible, and cleaned up on unload. Hidden Home Tabs are
made unfocusable with bounded delayed resynchronization because Steam may
replace private navigation nodes after the DOM appears settled.

This decision is protected by unit/contract tests and live controller
acceptance tests after Steam or upstream updates.
