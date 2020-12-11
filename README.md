# focus-next
Raise and focus the closest window in *left* | *up* | *right* or *down* direction.

Currently works only on x11 desktops.

Use it from commandline as follows:  
`node focus-next.js DIRECTION`  
Where DIRECTION is one of:
* left
* up
* right
* down

(mind the lower case!)

# 'installation'
Dependencies are
* xdotool
* nodejs (current stable)

Simply bind global shortcuts commands like this:
> Meta + Alt + LeftArrow => `node /path/to/focus-next.js left`  
> Meta + Alt + RightArrow => `node /path/to/focus-next.js right`  




happy fiddling ;-)