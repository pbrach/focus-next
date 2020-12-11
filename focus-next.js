const { exec } = require('child_process');

class WindowSpec
{
    constructor()
    {
        this.id = "";
        this.name = "";
        this.position = { left: 0, top: 0 };
        this.dimension = { width: 0, height: 0 };
    }
}


function handleError(error, stderr, rejectCallback)
{
    if (error || stderr) {
        let errorText = 'An error occured:\n';
        errorText += error.message + ' ' + stderr;
        rejectCallback(errorText);
    }
}
function getWinIds()
{
    return new Promise((resolve, reject) =>
    {
        exec('xdotool search --onlyvisible --sync --all --name --class --classname "\\S+"',
            (error, stdout, stderr) =>
            {
                handleError(error, stderr, reject);

                stdout = stdout.trim();
                resolve(stdout.split('\n'));
            });
    });
}

function getName(id)
{
    const command = `xdotool getwindowname ${id}`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            handleError(error, stderr, reject);

            resolve(stdout.trim());
        });
    });
}

function getFocusedId()
{
    const command = `xdotool getwindowfocus`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            handleError(error, stderr, reject);

            resolve(stdout.trim());
        });
    });
}

const regexp = /^Window\s.*\n\s\sPosition:\s(.*),(.*)\s\(.*\n\s\sGeometry:\s(.*)x(.*)/m;
function getGeometry(id)
{
    const command = `xdotool getwindowgeometry ${id}`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            handleError(error, stderr, reject);

            const match = stdout.match(regexp);
            const result = {
                position: { left: match[1], top: match[2] },
                dimension: { width: match[3], height: match[4] },
            }
            resolve(result);
        });
    });
}

// selectwindow
// windowfocus
function focusWindow(id){
    const command = `xdotool windowraise ${id} && xdotool windowfocus ${id}`;
    return new Promise((resolve, reject) =>
    {
        exec(command, (error, stdout, stderr) =>
        {
            handleError(error, stderr, reject);

            resolve();
        });
    });
}

async function getCurrentWindows(){
    const ids = await getWinIds();

    const windows = {};
    for (let idx = 0; idx < ids.length; idx++) {
        const winSpec = new WindowSpec();
        winSpec.id = ids[idx];
        winSpec.name = await getName(winSpec.id);
        if (winSpec.name === 'Desktop')
            continue;

        const geom = await getGeometry(winSpec.id);
        winSpec.position = geom.position;
        winSpec.dimension = geom.dimension;

        if (winSpec.dimension.width * winSpec.dimension.height < 5)
            continue;

        windows[winSpec.id] = winSpec;
    }
    
    return windows;
}

(async () =>
{
    const windows = await getCurrentWindows();

    console.log(windows);
    
    const focusedId = await getFocusedId();
    console.log(windows[focusedId]);
    delete windows[focusedId];
    for(const id in windows)
    {
        if(!windows.hasOwnProperty(id))
            continue;
        
        await focusWindow(id);
    }
})();
