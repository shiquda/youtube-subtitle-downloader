// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showSubtitles') {
        // 打开popup窗口
        chrome.windows.create({
            url: 'popup.html',
            type: 'popup',
            width: 320,
            height: 480
        }, (window) => {
            // 将字幕数据传递给popup
            chrome.tabs.sendMessage(sender.tab.id, {
                action: 'updateSubtitles',
                subtitles: request.subtitles
            });
        });
    }
}); 