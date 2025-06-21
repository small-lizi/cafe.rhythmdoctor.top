<?php
/**
 * 节奏医生谱面站 - 下载中转服务
 * 
 * 此脚本接收原始下载链接，通过服务器中转下载谱面文件
 * 实现了以下功能：
 * 1. URL验证和安全检查
 * 2. 允许的域名白名单
 * 3. 文件转发和适当的响应头处理
 */

// 设置无限执行时间，因为下载可能需要较长时间
set_time_limit(0);

// 获取要下载的URL
$fileUrl = isset($_GET['url']) ? $_GET['url'] : '';

// 验证URL (安全检查)
if (empty($fileUrl) || !filter_var($fileUrl, FILTER_VALIDATE_URL)) {
    header('HTTP/1.1 400 Bad Request');
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('error' => '无效的下载链接'));
    exit;
}

// 限制只允许特定域名的下载
$allowedDomains = array('codex.rhythm.cafe', 'rhythm.cafe', 'cdn.rhythm.cafe', 'drive.google.com', 'docs.google.com', 'mega.nz', 'cdn.discordapp.com');
$urlParts = parse_url($fileUrl);
$isAllowed = false;

if (isset($urlParts['host'])) {
    $host = $urlParts['host'];
    foreach ($allowedDomains as $domain) {
        if (strpos($host, $domain) !== false) {
            $isAllowed = true;
            break;
        }
    }
}

if (!$isAllowed) {
    header('HTTP/1.1 403 Forbidden');
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('error' => '不允许下载该域名的文件'));
    exit;
}

// 获取文件信息
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $fileUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_NOBODY, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$contentLength = curl_getinfo($ch, CURLINFO_CONTENT_LENGTH_DOWNLOAD);

// 获取文件名
if (isset($urlParts['path'])) {
    $fileName = basename($urlParts['path']);
} else {
    $fileName = '';
}

// 如果文件名不正确或为空，尝试使用其他方法获取
if (empty($fileName) || $fileName == '/' || $fileName == '') {
    // 尝试从Content-Disposition头获取文件名
    preg_match('/Content-Disposition: .*filename=(?<filename>[^\s]+|\x22[^\x22]+\x22)/i', $response, $matches);
    if (isset($matches['filename'])) {
        $fileName = trim($matches['filename'], '"\'');
    } else {
        // 如果仍然没有文件名，使用随机文件名
        $fileName = 'chart_' . time() . '.rdzip';
    }
}

curl_close($ch);

// 记录下载请求
error_log("Download requested: $fileUrl [$httpCode] ($fileName)");

// 如果HEAD请求成功，继续下载
if ($httpCode >= 200 && $httpCode < 300) {
    // 设置适当的响应头
    header('Content-Type: ' . ($contentType ?: 'application/octet-stream'));
    
    // 只有当Content-Length有效时才设置
    if ($contentLength && $contentLength > 0) {
        header('Content-Length: ' . $contentLength);
    }
    
    // 确保文件名正确编码
    $encodedFileName = rawurlencode($fileName);
    header('Content-Disposition: attachment; filename="' . $fileName . '"; filename*=UTF-8\'\'' . $encodedFileName);
    
    // 禁用缓存以确保实时下载
    header('Pragma: public');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Cache-Control: post-check=0, pre-check=0', false);
    header('Expires: 0');
    
    // 分块读取并输出文件内容
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $fileUrl);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 0); // 无超时限制
    
    // 直接将输出发送到浏览器
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($curl, $data) {
        echo $data;
        return strlen($data);
    });
    
    curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        error_log("Download error: $error");
    }
} else {
    // 文件不存在或无法访问
    header('HTTP/1.1 404 Not Found');
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('error' => '文件不存在或无法访问', 'http_code' => $httpCode));
    error_log("Failed download: $fileUrl [$httpCode]");
}
?> 