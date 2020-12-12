const { exec } = require('child_process');

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
    return new Promise((resolve, reject) =>
    {
        exec('xdotool search --onlyvisible --sync --all --name --class --classname "\\S+"',
            (error, stdout, stderr) =>
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

            const stateText = stdout.split('Window state:')[1];
            if (!stateText)
                resolve(false);
            else
                resolve(stateText.includes('Hidden'));
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