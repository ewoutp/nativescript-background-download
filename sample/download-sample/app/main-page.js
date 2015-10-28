var observable = require("data/observable");
var observableArray = require("data/observable-array");

var bghttp = require("nativescript-background-download");
var fs = require("file-system");
var path = fs.path;

var viewModel = new observable.Observable();
var tasks = new observableArray.ObservableArray();

function pageLoaded(args) {
    var page = args.object;

    viewModel.set("tasks", tasks);
    page.bindingContext = viewModel;
}
exports.pageLoaded = pageLoaded;

var session = bghttp.session("bigfile-download");


function logEvent(e) {
	console.log(e.eventName);
}

function downloadNow() {
    var dest = path.join(fs.knownFolders.documents().path, "image.jpg");
    var request = {
        url : "https://github.com/NativeScript/nativescript-background-http/raw/master/examples/SimpleBackgroundHttp/app/bigpic.jpg",
        description: "{ 'downloading': 'bigpic.jpg' }"
    };
    var task = session.downloadFile(dest, request);

    task.on("progress", logEvent);
    task.on("error", logEvent);
    task.on("complete", logEvent);

    tasks.push(task);
}
exports.downloadNow = downloadNow;
