var data_observable = require("data/observable");
var Observable = data_observable.Observable;

var runloop = CFRunLoopGetCurrent();
var defaultRunLoopMode = NSString.stringWithString(kCFRunLoopCommonModes);

function invokeOnMainRunLoop(func) {
    CFRunLoopPerformBlock(runloop, defaultRunLoopMode, func);
    CFRunLoopWakeUp(runloop);
}

var SessionDelegate = NSObject.extend({
    // NSURLSessionDelegate
    URLSessionDidBecomeInvalidWithError: function(session, error) {
        console.log("URLSessionDidBecomeInvalidWithError:");
        console.log(" - session: " + session);
        console.log(" - error:   " + error);
    },
    URLSessionDidReceiveChallengeCompletionHandler: function(session, challenge, completionHandler) {
        console.log("URLSessionDidFinishEventsForBackgroundURLSession: " + session + " " + challenge);
        var disposition = null;
        var credential = null;
        completionHandler(disposition, credential);
    },
    URLSessionDidFinishEventsForBackgroundURLSession: function(session) {
        console.log("URLSessionDidFinishEventsForBackgroundURLSession: " + session);
    },

    // NSURLSessionDownloadDelegate
    URLSessionDownloadTaskDidResumeAtOffsetExpectedTotalBytes: function(session, downloadTask, fileOffset, expectedTotalBytes) {
        invokeOnMainRunLoop(function() {
            var jsTask = getTask(session, downloadTask);
            jsTask.set("totalDownload", expectedTotalBytes);
            jsTask.set("download", fileOffset);
            jsTask.set("status", "downloading");
            jsTask.notify({
                eventName: "progress",
                object: jsTask,
                currentBytes: fileOffset,
                totalBytes: expectedTotalBytes
            });
        });
    },
    URLSessionDownloadTaskDidWriteDataTotalBytesWrittenTotalBytesExpectedToWrite: function(session, downloadTask, bytesWritten, totalBytesWritten, totalBytesExpectedToWrite) {
        invokeOnMainRunLoop(function() {
            var jsTask = getTask(session, downloadTask);
            jsTask.set("totalDownload", totalBytesExpectedToWrite);
            jsTask.set("download", totalBytesWritten);
            jsTask.set("status", "downloading");
            jsTask.notify({
                eventName: "progress",
                object: jsTask,
                currentBytes: totalBytesWritten,
                totalBytes: totalBytesExpectedToWrite
            });
        });
    },
    URLSessionDownloadTaskDidFinishDownloadingToURL: function(session, downloadTask, location) {
        console.log("URLSessionDownloadTaskDidFinishDownloadingToURL");
        // TODO
        // A file URL for the temporary file. Because the file is temporary, you must either open
        // the file for reading or move it to a permanent location in your app’s sandbox container
        // directory before returning from this delegate method.
        var jsTask = getTask(session, downloadTask);
        var downloadFile = NSURL.fileURLWithPath(jsTask.get("downloadFile"));
        var fileManager = NSFileManager.defaultManager();
        // Remove destination first
        fileManager.removeItemAtURLError(downloadFile, null)
        try {
            fileManager.copyItemAtURLToURLError(location, downloadFile)
            console.log("copyItemAtURLToURLError from " + location + " to " + downloadFile + " succeeded");
        } catch (err) {
            console.log("copyItemAtURLToURLError from " + location + " to " + downloadFile + " failed: " + err);
        }
    },

    // NSURLSessionTaskDelegate
    URLSessionTaskDidCompleteWithError: function(session, nsTask, error) {
        console.log("URLSessionTaskDidCompleteWithError");
        var jsTask = getTask(session, nsTask);
        if (error) {
            jsTask.set("status", "error");
            jsTask.notify({
                eventName: "error",
                object: jsTask,
                error: error
            });
        } else {
            jsTask.set("download", nsTask.countOfBytesReceived);
            jsTask.set("totalDownload", nsTask.countOfBytesExpectedToReceive);

            jsTask.set("status", "complete");
            jsTask.notify({
                eventName: "progress",
                object: jsTask,
                currentBytes: nsTask.countOfBytesSent,
                countOfBytesReceived: nsTask.countOfBytesExpectedToReceive
            });
            jsTask.notify({
                eventName: "complete",
                object: jsTask
            });
        }
    },
    URLSessionTaskDidReceiveChallengeCompletionHandler: function(session, task, challenge, completionHandler) {
        console.log("URLSessionTaskDidReceiveChallengeCompletionHandler: " + session + " " + task + " " + challenge);
        var disposition = null;
        var credential = null;
        completionHandler(disposition, credential);
    },
    URLSessionTaskDidSendBodyDataTotalBytesSentTotalBytesExpectedToSend: function(session, task, data, sent, expectedTotal) {
        console.log("URLSessionTaskDidSendBodyDataTotalBytesSentTotalBytesExpectedToSend: " + session + " " + task + " " + data + " " + sent + " " + expectedTotal);
    },
    URLSessionTaskNeedNewBodyStream: function(session, task, need) {
        console.log("URLSessionTaskNeedNewBodyStream");
    },
    URLSessionTaskWillPerformHTTPRedirectionNewRequestCompletionHandler: function(session, task, redirect, request, completionHandler) {
        console.log("URLSessionTaskWillPerformHTTPRedirectionNewRequestCompletionHandler");
        completionHandler(request);
    }
}, {
    name: "BackgroundDownloadDelegate",
    protocols: [
        NSURLSessionDelegate,
        NSURLSessionTaskDelegate,
        NSURLSessionDownloadDelegate
    ]
});

// TODO: Create a mechanism to clean sessions from the cache that have all their tasks completed, canceled or errored out.
var sessions = {};

function session(id) {

    var jsSession = sessions[id];
    if (jsSession) {
        return jsSession;
    }

    var delegate = SessionDelegate.alloc().init();
    var configuration = NSURLSessionConfiguration.backgroundSessionConfigurationWithIdentifier(id);
    var session = NSURLSession.sessionWithConfigurationDelegateDelegateQueue(configuration, delegate, null);

    function downloadFile(fileUri, options) {

        var url = NSURL.URLWithString(options.url);

        var newTask = session.downloadTaskWithURL(url);
        newTask.taskDescription = options.description;
        jsTask = getTask(session, newTask);
        jsTask.set("downloadFile", fileUri);
        newTask.resume();

        return jsTask;
    }

    jsSession = new Observable();
    jsSession.set("ios", session);
    jsSession.set("downloadFile", downloadFile);
    sessions[id] = jsSession;

    return jsSession;
}
exports.session = session;

var tasks = new WeakMap();

function getTask(nsSession, nsTask) {
    var jsTask = tasks.get(nsTask);
    if (jsTask) {
        return jsTask;
    }

    jsTask = new Observable();

    jsTask.set("ios", nsTask);
    jsTask.set("session", nsSession);
    jsTask.set("description", nsTask.taskDescription);

    jsTask.set("download", nsTask.countOfBytesReceived);
    jsTask.set("totalDownload", nsTask.countOfBytesExpectedToReceive);

    if (nsTask.error) {
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

    // Put in the cache
    tasks.set(nsTask, jsTask);

    return jsTask;
}
