# About `focus-next`

Will be a simple command line tool

For the x11 window system (its fastly dying, I know)

Commands are supposed to be bound to keybord shortcuts

They allow to **focus** the next window to the: 
    north, 
    east, 
    south, 
    west
depending on the current windows coordinates and all other windows coords.

As an alternative to the common Alt+Tab cycle-through-windows.





# Technical View / Architecture
Use:
- command line tools (packages): xdotool x11-utils
- build app via nodejs and process invoke
- create abstraction API layer to easily integrate other tools (Wayland adoption?)
- provide CLI with:
    `focus-next [option] <direction>`
    -? -h --help
    -v --verbose: write to stdout the direction, origin window, next window
    directions:
        north
        east
        south
        west
- needs mini-persistance for 0 dist special cases: cycle through all 0 dists, after done ignore them
- E.g.: if cmd is `focus-next east` do these things:
    1. get this windows mass center coord (probaly better to use top-left only)
    2. get all other windows mass centers
    3. filter to: only those that are in a 45degree angle to the right (special case: most right window)
    4. sort to: nearest in x and focus to that

# Resources
https://unix.stackexchange.com/questions/14159/how-do-i-find-the-window-dimensions-and-position-accurately-including-decoration/156349#156349
xwininfo
xdotool
https://www.systutorials.com/docs/linux/man/1-xdotool/
https://www.linux.org/threads/xdotool-window.10606/
https://www.systutorials.com/docs/linux/man/1-xdotool/


# Outlook
- Package everything for debian/ubuntu (my system)
- Package for other distros
- create wayland adoption
- add mix/diagonal directions: north-east, south-east, south-west, north-west
- create config file: 
    use center of mass, 
    use top-left, 
    use nearest in direction, 
    what to do at out most positions
    
# CMDS
xdotool search --onlyvisible --sync --name "\S+" | xargs -L1 xwininfo -id
xdotool search --onlyvisible --sync --name "\S+" | xargs -L1 xdotool getwindowname

xdotool search --onlyvisible --sync --all --name --class --classname "\S+" | xargs -L1 xdotool getwindowname
xdotool search --onlyvisible --sync --all --name --class --classname "\S+" | xargs -L1 xwininfo -id

xdotool search --onlyvisible --sync --all --name --class --classname "\S+" | xargs -L1 xdotool getwindowgeometry