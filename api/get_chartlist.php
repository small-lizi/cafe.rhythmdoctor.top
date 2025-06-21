<?php
/**
 * 节奏医生谱面站 - API中转服务
 * 
 * 此脚本接收来自前端的请求，转发到原始API，并将结果返回给前端
 * 实现了以下功能：
 * 1. 自动添加API密钥到请求头
 * 2. 转发所有查询参数
 * 3. 简单的错误处理
 */

// 设置响应头为JSON
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // 允许跨域请求，根据需要修改
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

// 配置参数
$api_key = 'nicolebestgirl'; // API密钥
$api_base_url = 'https://orchardb.fly.dev/typesense/collections/levels/documents/search'; // 原始API地址

// 准备请求参数
$params = array();

// 检查是否有查询参数
if (isset($_GET) && !empty($_GET)) {
    $params = $_GET;
}

// 确保必要的参数存在
if (!isset($params['q']) || empty($params['q'])) {
    $params['q'] = '*'; // 如果没有搜索词，使用通配符搜索所有内容
}

// 添加必要的默认参数
if (!isset($params['query_by'])) {
    $params['query_by'] = 'song,authors,artist,tags,description';
}

if (!isset($params['query_by_weights'])) {
    $params['query_by_weights'] = '12,8,6,5,4';
}

if (!isset($params['facet_by'])) {
    $params['facet_by'] = 'authors,tags,source,difficulty,artist';
}

if (!isset($params['per_page'])) {
    $params['per_page'] = 12; // 默认每页12个结果
}

if (!isset($params['max_facet_values'])) {
    $params['max_facet_values'] = '10';
}

if (!isset($params['filter_by'])) {
    $params['filter_by'] = 'approval:=[10..20]'; // 默认只显示高质量谱面
}

if (!isset($params['page'])) {
    $params['page'] = 1; // 默认第1页
}

if (!isset($params['sort_by'])) {
    $params['sort_by'] = '_text_match:desc,indexed:desc,last_updated:desc';
}

if (!isset($params['num_typos'])) {
    $params['num_typos'] = '2,1,1,1,0';
}

// 构建查询字符串
$query_string = http_build_query($params);
$request_url = $api_base_url . '?' . $query_string;

// 初始化cURL会话
$ch = curl_init();

// 设置cURL选项
curl_setopt($ch, CURLOPT_URL, $request_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30); // 设置超时时间为30秒

// 添加API密钥到请求头
$headers = array(
    'x-typesense-api-key: ' . $api_key,
    'Content-Type: application/json'
);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

// 执行请求
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

// 检查是否有错误
if ($response === false) {
    $error = array(
        'success' => false,
        'error' => curl_error($ch),
        'message' => '请求原始API时发生错误'
    );
    echo json_encode($error);
    curl_close($ch);
    exit;
}

// 关闭cURL会话
curl_close($ch);

// 检查HTTP状态码
if ($http_code != 200) {
    $error = array(
        'success' => false,
        'http_code' => $http_code,
        'message' => '原始API返回错误状态码',
        'response' => json_decode($response, true)
    );
    echo json_encode($error);
    exit;
}

// 输出API响应
echo $response;
?>
