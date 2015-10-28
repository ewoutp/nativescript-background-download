A cross platform plugin for [the NativeScript framework](http://www.nativescript.org), that provides background download for iOS and Android.

### Source
 - [GitHub](http://github.com/ewoutp/nativescript-background-download)

### License
[Apache-2.0](https://github.com/ewoutp/nativescript-background-download/blob/master/LICENSE)

### How-To Background Download

```js
var bghttp = require("nativescript-background-download");

var session = bghttp.session("bigfile-download");

var request = {
    url: "http://myserver.com/bigfile.tar.gz",
    description: "{ 'downloading': 'bigfile.tar.gz' }"
};

var task = session.downloadFile("file/path/bigfile.tar.gz", request);

task.on("progress", logEvent);
task.on("error", logEvent);
task.on("complete", logEvent);

function logEvent(e) {
	console.log(e.eventName);
}
```

### How-To Data Binding
Task implementations are Observable and fire property change events for
 - download
 - totalDownload
 - status

So you can bind to task properties in the UI markup:
```xml
<ListView items="{{ tasks }}">
	<ListView.itemTemplate>
		<StackLayout>
			<Label text="{{ download, 'Download: ' + download + ' / ' + totalDownload }}" />
			<Progress value="{{ download }}" maxValue="{{ totalDownload }}" />
			<Label text="{{ description, 'description: ' + description }}" />
			<Label text="{{ status, 'status: ' + status }}" />
		</StackLayout>
	</ListView.itemTemplate>
</ListView>
```
