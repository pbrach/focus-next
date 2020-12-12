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

Future:  
* stack (switch between a stack of overlappiing windows nearby)
* raizeall (raise all minimized windows, somehow this is not natively possible in my distro)

(mind the lower case!)

# idea
Instead of the shitty `Alt + Tab` way of cycling through a sequential list 
that depicts all open windows, I rather want to have a shortcut that 
lets me focus a
specific windows that I see on my current screen. So the big idea here is:  

> Manage and focus windows you actually see.  

Or stating the purpose in a more negative way:  

> Do not divert the users attention from what can be seen on 
> screen, to a sequential list of items that need to be
> mapped to the actual windows. 

## focussing mechanics
So for a new way of setting focus to a window I needed to define the mechanics of how to focus 
the next window. The guiding principles for this are: 
* It must **feel intuitive**
* Is based on **what you actually see**

So currently I decided on the following assumptions:
* Always filter potential focus candidate windows by the direction given by the user.
Only allow focus on the filtered windows. So the command `focus-next left` 
will never allow to select a window to the right of the current focused window, 
even if there is no window on the left side of it.
* Prioritize to focus windows that are positioned along the focus direction. So even
if a window is closer and in the correct direction, it should not be selected if 
there is a more distanced window that is reachable with a lower deviation in angle.
```
X----                     X---- 
| A |                     | C |
-----    X----            -----
         | B |         
         -----          
        
         
        
 X----
 | D |
 -----        
         
```
If **A** is focused, `focus-next right` should focus **C** next instead of **B**. 
However, this might lead to a problem: if the user now actually wants to focus 
**B**, it might not be possible: in 'right' direction **C** would be selected 
and in 'down' direction **D** would be selected (Because in both cases another
window has a better angle). To handle this scenario, the diagonal selection 
with a combination of two arrows would be needed.

This is something difficult: an OS shortcut is normally not able to handle two
arrows in a combination... so focus-next needs to handle these scenarios: if 
within 300 msec a second call to focus-next in a different direction is 
triggered, the diagonal mode is started and the first call removed.

* If a window is minimized: don't allow to raise and focus it
* If a window can't be seen (behind other windows) make it possible to focus,
but with last priority to other windows, because the user probably wants to 
select something else that he/she can actually see.
* The previous point might introduce problems if a user actually wants to be
able to focus all available windows, or investigate all the windows that are stacked
above eachother. In such a case one should be able switch through a roghtly overlapping
stack of windows with a distinct command.


# 'installation'
Dependencies are
* xdotool
* x11-utils (or only: xwininfo)
* nodejs (current stable)

Simply bind global shortcuts commands like this:
> Meta + Alt + LeftArrow => `node /path/to/focus-next.js left`  
> Meta + Alt + RightArrow => `node /path/to/focus-next.js right`  


# outlook
This is currently just a prototype to test different selection methods
in order to make something more rounded and user friendly. 

In future it would be very nice to support different linux (x11 and wayland) 
desktops and windows as well. However: I will never try target MacOS (sorry).

If this project is continued, I would like to have a simple installer or
package and make the tool easily configurable. Perhaps even with a **tiny** UI 
for configuration or even visual feedback.

...but for now I can only say:
```
happy fiddling ;-)
```