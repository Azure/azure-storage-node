echo off

md bundle

browserify -r stream -r util -r buffer azure-storage.blob.export.js azure-storage.file.export.js azure-storage.queue.export.js azure-storage.table.export.js -p [ factor-bundle -o bundle/azure-storage.blob.js -o bundle/azure-storage.file.js -o bundle/azure-storage.queue.js -o bundle/azure-storage.table.js] -o bundle/azure-storage.common.js 