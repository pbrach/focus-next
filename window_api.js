const { exec } = require('child_process');

/**
 * @typedef {import('./common.js').Dimension} Dimension
 * @typedef {import('./common.js').Position} Position
 * @typedef {import('./common.js').WindowGeometry} WindowGeometry
 */

function _handleError(error, stderr, rejectCallback)
{
    if (error || stderr) {
        let errorText = 'An error occured:\n';
        errorText += error.message + ' ' + stderr;
        rejectCallback(errorText);
    }
}

exports.getCurrentWindowIds = function ()
{
    const command = 'xdotool search --onlyvisible --sync --all --name --class --classname "\\S+"';
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
            {
                _handleError(error, stderr, reject);

                stdout = stdout.trim();
                resolve(stdout.split('\n'));
            });
    });
}

exports.getWindowName = function (id)
{
    const command = `xdotool getwindowname ${id}`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            _handleError(error, stderr, reject);

            resolve(stdout.trim());
        });
    });
}

exports.getCurrentFocusedWindowId = function ()
{
    const command = `xdotool getwindowfocus`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            _handleError(error, stderr, reject);

            resolve(stdout.trim());
        });
    });
}

const geometry_regexp = /^Window\s.*\n\s\sPosition:\s(.*),(.*)\s\(.*\n\s\sGeometry:\s(.*)x(.*)/m;
/**
 * @param {number} id 
 * @returns {WindowGeometry}
 */
exports.getWindowGeometry = function (id)
{
    const command = `xdotool getwindowgeometry ${id}`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            _handleError(error, stderr, reject);

            const match = stdout.match(geometry_regexp);
            const result = {
                position: { left: parseInt(match[1]), top: parseInt(match[2]) },
                dimension: { width: parseInt(match[3]), height: parseInt(match[4]) },
            }
            resolve(result);
        });
    });
}

exports.isWindowHidden = function (id)
{
    const command = `xwininfo -wm -id ${id}`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            _handleError(error, stderr, reject);

            const stateText = stdout.split('Window type:')[1];
            if (!stateText)
                resolve(false);
            else
                resolve(stateText.includes('Hidden') || !stateText.includes('Normal'));
        });
    });
}


exports.focusNext = async function (id)
{
    await raiseWindow(id);
    await focusWindow(id);
    await activateWindow(id);
}

function focusWindow(id)
{
    const command = `xdotool windowfocus --sync ${id}`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            _handleError(error, stderr, reject);
            resolve();
        });
    });
}

function raiseWindow(id)
{
    const command = `xdotool windowraise ${id}`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            _handleError(error, stderr, reject);
            resolve();
        });
    })
}

function activateWindow(id)
{
    const command = `xdotool windowactivate --sync ${id}`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            _handleError(error, stderr, reject);
            resolve();
        });
    })
}

// tried this als another focusWindow-alternative,
// in order to also get the underlying desktop actived.
// (not a primary problem, but would be good)
// ...however: it does not work!
function clickWindow(id)
{
    const command = `xdotool click --window ${id}`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            _handleError(error, stderr, reject);
            resolve();
        });
    })
}