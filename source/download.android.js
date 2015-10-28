var data_observable = require("data/observable");
var Observable = data_observable.Observable;
var app = require("application");
var DownloadManager = android.app.DownloadManager;
var Uri = android.net.Uri;

// TODO: Create a mechanism to clean sessions from the cache that have all their tasks completed, canceled or errored out.
var sessions = {};

function session(id) {

    var jsSession = sessions[id];
    if (jsSession) {
        return jsSession;
    }

    app.android.registerBroadcastReceiver(DownloadManager.ACTION_DOWNLOAD_COMPLETE, function onReceiveCallback(context, intent) {
        var requestID = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, 0);
        console.log("Download complete broadcast: " + requestID);
        var key = "" + requestID;
        var jsTask = tasks[key];
        if (!jsTask) {
            return;
        }
        console.log("Download complete broadcast of a jsTask: " + requestID);
        if (isDownloadSuccessful(requestID)) {
            var downloadManager = app.android.context.getSystemService(android.content.Context.DOWNLOAD_SERVICE);
            var tmpUri = downloadManager.getUriForDownloadedFile(requestID);
            var tmpFile = new java.io.File(tmpUri.getPath());
            var destFile = new java.io.File(jsTask.get("downloadFile"));
            tmpFile.renameTo(destFile);

            console.log("Download succeeded");
        } else {
            console.log("Download failed");
        }
    });

    function downloadFile(fileUri, options) {

        console.log("downloadFile " + fileUri + " " + options);
        var uri = Uri.parse(options.url);
        var downloadManager = app.android.context.getSystemService(android.content.Context.DOWNLOAD_SERVICE);
        var request = new DownloadManager.Request(uri);
        //request.setDestinationUri(destUri);
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_HIDDEN);
        request.setVisibleInDownloadsUi(false);
        if (options.description) {
            request.setTitle(options.description);
        }

        console.log("downloadManager.enqueue");
        var requestID = downloadManager.enqueue(request);

        jsTask = getTask(requestID);
        jsTask.set("downloadFile", fileUri);
        jsTask.set("description", options.description);

        console.log("return jsTask");
        return jsTask;
    }

    jsSession = new Observable();
    jsSession.set("android", {});
    jsSession.set("downloadFile", downloadFile);
    sessions[id] = jsSession;

    return jsSession;
}
exports.session = session;

var tasks = {};

function getTask(requestID) {
    var key = "" + requestID;
    var jsTask = tasks[key];
    if (jsTask) {
        return jsTask;
    }

    jsTask = new Observable();

    jsTask.set("android", {});
    jsTask.set("requestID", requestID);

    jsTask.set("download", 0);
    jsTask.set("totalDownload", 0);

    /*    if (nsTask.error) {
            // TODO: Consider adding error property on the task.
            jsTask.set("status", "error");
        } else {
            if (nsTask.state == NSURLSessionTaskState.NSURLSessionTaskStateRunning) {
                jsTask.set("status", "downloading");
            } else if (nsTask.state == NSURLSessionTaskState.NSURLSessionTaskStateCompleted) {
                jsTask.set("status", "complete");
            } else if (nsTask.state == NSURLSessionTaskState.NSURLSessionTaskStateCanceling) {
                jsTask.set("status", "error");
            } else if (nsTask.state == NSURLSessionTaskState.NSURLSessionTaskStateSuspended) {
                jsTask.set("status", "pending");
            }
        }
    */
    // Put in the cache
    tasks[key] = jsTask;

    return jsTask;
}

function isDownloadSuccessful(requestID) {
    console.log("Checking download status for id: " + requestID);
    //Verify if download is a success
    var downloadManager = app.android.context.getSystemService(android.content.Context.DOWNLOAD_SERVICE);
    var cursor = downloadManager.query(new DownloadManager.Query().setFilterById([requestID]));

    if (cursor.moveToFirst()) {
        var status = cursor.getInt(cursor.getColumnIndex(DownloadManager.COLUMN_STATUS));

        if (status == DownloadManager.STATUS_SUCCESSFUL) {
            console.log("File was downloaded properly");
            return true;
        } else {
            var reason = cursor.getInt(cursor.getColumnIndex(DownloadManager.COLUMN_REASON));
            console.log("Download not correct, status [" + status + "] reason [" + reason + "]");
            return false;
        }
    }
    return false;
}
