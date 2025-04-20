document.addEventListener('DOMContentLoaded', () => {
    const statusElement = document.getElementById('status');
    const subtitleList = document.getElementById('subtitleList');
    const refreshBtn = document.getElementById('refreshBtn');

    // 初始化
    checkCurrentPage();

    // 刷新按钮点击事件
    refreshBtn.addEventListener('click', () => {
        checkCurrentPage();
    });

    // 检查当前页面并获取字幕
    async function checkCurrentPage() {
        statusElement.textContent = '正在检测当前页面...';
        subtitleList.innerHTML = '';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('youtube.com/watch')) {
                statusElement.textContent = '请在YouTube视频页面使用此功能';
                return;
            }

            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSubtitles' });

            if (response.error) {
                statusElement.textContent = response.error;
                return;
            }

            // 获取视频标题
            const videoTitle = await getVideoTitle(tab.id);

            displaySubtitles({
                ...response,
                videoTitle
            });
        } catch (error) {
            statusElement.textContent = `获取字幕失败: ${error.message}`;
        }
    }

    // 获取视频标题
    async function getVideoTitle(tabId) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, { action: 'getVideoTitle' });
            if (response.error) {
                return 'YouTube视频';
            }
            // 过滤非法字符
            return response.title.replace(/[<>:"/\\|?*]/g, '_');
        } catch (error) {
            return 'YouTube视频';
        }
    }

    // 显示字幕列表
    function displaySubtitles(data) {
        statusElement.textContent = '选择要下载的字幕：';

        const { autoCaptions, manualCaptions, videoTitle } = data;

        if (autoCaptions.length === 0 && manualCaptions.length === 0) {
            subtitleList.innerHTML = '<div class="subtitle-item">当前视频没有可用的字幕</div>';
            return;
        }

        if (autoCaptions.length > 0) {
            const autoSection = document.createElement('div');
            autoSection.className = 'subtitle-section';
            autoSection.innerHTML = '<h3>自动生成字幕</h3>';

            autoCaptions.forEach(caption => {
                autoSection.appendChild(createSubtitleItem(caption, videoTitle));
            });

            subtitleList.appendChild(autoSection);
        }

        if (manualCaptions.length > 0) {
            const manualSection = document.createElement('div');
            manualSection.className = 'subtitle-section';
            manualSection.innerHTML = '<h3>手动添加字幕</h3>';

            manualCaptions.forEach(caption => {
                manualSection.appendChild(createSubtitleItem(caption, videoTitle));
            });

            subtitleList.appendChild(manualSection);
        }
    }

    // 创建字幕项
    function createSubtitleItem(caption, videoTitle) {
        const item = document.createElement('div');
        item.className = 'subtitle-item';

        // 创建格式选择下拉菜单
        const formatSelect = document.createElement('select');
        formatSelect.className = 'format-select';
        formatSelect.innerHTML = `
            <option value="srt">SRT格式</option>
            <option value="txt">TXT格式</option>
        `;

        item.innerHTML = `
            <div class="subtitle-info">
                <span>${caption.languageName}</span>
                ${formatSelect.outerHTML}
            </div>
            <div class="button-group">
                <button class="button copy-btn">复制</button>
                <button class="button download-btn">下载</button>
            </div>
        `;

        const copyBtn = item.querySelector('.copy-btn');
        const downloadBtn = item.querySelector('.download-btn');

        // 复制按钮点击事件
        copyBtn.addEventListener('click', async () => {
            try {
                item.classList.add('downloading');
                copyBtn.disabled = true;
                downloadBtn.disabled = true;

                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

                // 下载字幕
                const response = await fetch(caption.baseUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const xmlContent = await response.text();
                const selectedFormat = item.querySelector('.format-select').value;

                let content;
                if (selectedFormat === 'srt') {
                    content = convertXmlToSrt(xmlContent);
                } else {
                    content = convertXmlToTxt(xmlContent);
                }

                // 复制到剪贴板
                await navigator.clipboard.writeText(content);
                statusElement.textContent = '字幕已复制到剪贴板';

            } catch (error) {
                statusElement.textContent = `复制字幕失败: ${error.message}`;
            } finally {
                item.classList.remove('downloading');
                copyBtn.disabled = false;
                downloadBtn.disabled = false;
            }
        });

        // 下载按钮点击事件
        downloadBtn.addEventListener('click', async () => {
            try {
                item.classList.add('downloading');
                copyBtn.disabled = true;
                downloadBtn.disabled = true;

                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

                // 下载字幕
                const response = await fetch(caption.baseUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const xmlContent = await response.text();
                const selectedFormat = item.querySelector('.format-select').value;

                let content, extension;
                if (selectedFormat === 'srt') {
                    content = convertXmlToSrt(xmlContent);
                    extension = 'srt';
                } else {
                    content = convertXmlToTxt(xmlContent);
                    extension = 'txt';
                }

                // 创建下载链接
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;

                // 生成文件名
                const fileName = generateFileName(videoTitle, caption.languageName, caption.isAutoGenerated, extension);
                a.download = fileName;

                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

            } catch (error) {
                statusElement.textContent = `下载字幕失败: ${error.message}`;
            } finally {
                item.classList.remove('downloading');
                copyBtn.disabled = false;
                downloadBtn.disabled = false;
            }
        });

        return item;
    }

    // 生成文件名
    function generateFileName(videoTitle, languageName, isAutoGenerated, extension) {
        // 清理文件名中的非法字符
        const cleanTitle = videoTitle.replace(/[<>:"/\\|?*]/g, '_');
        // 添加语言标识
        const languageSuffix = isAutoGenerated ? `(${languageName}-自动生成)` : `(${languageName})`;
        // 组合文件名
        return `${cleanTitle}${languageSuffix}.${extension}`;
    }

    // 将XML格式的字幕转换为SRT格式
    function convertXmlToSrt(xmlContent) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            const textElements = xmlDoc.getElementsByTagName('text');

            let srtContent = '';
            let index = 1;

            for (let i = 0; i < textElements.length; i++) {
                const text = textElements[i];
                const start = parseFloat(text.getAttribute('start'));
                const dur = parseFloat(text.getAttribute('dur'));
                const end = start + dur;

                // 序号
                srtContent += index + '\n';

                // 时间轴
                srtContent += formatTime(start) + ' --> ' + formatTime(end) + '\n';

                // 字幕文本
                srtContent += text.textContent + '\n\n';

                index++;
            }

            return srtContent;
        } catch (error) {
            throw new Error('转换字幕格式失败');
        }
    }

    // 将XML格式的字幕转换为TXT格式
    function convertXmlToTxt(xmlContent) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            const textElements = xmlDoc.getElementsByTagName('text');

            let txtContent = '';

            for (let i = 0; i < textElements.length; i++) {
                const text = textElements[i];
                txtContent += text.textContent + '\n';
            }

            return txtContent.trim();
        } catch (error) {
            throw new Error('转换字幕格式失败');
        }
    }

    // 格式化时间
    function formatTime(seconds) {
        const date = new Date(seconds * 1000);
        const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const mm = String(date.getUTCMinutes()).padStart(2, '0');
        const ss = String(date.getUTCSeconds()).padStart(2, '0');
        const ms = String(Math.floor((seconds % 1) * 1000)).padStart(3, '0');
        return `${hh}:${mm}:${ss},${ms}`;
    }
}); 