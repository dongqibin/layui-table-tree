<?php

$res = [
    'code1' => 0,
    'msg1'  => '成功',
    'count1'=> 6,
    'data1' => [],
];

$dbData = [
    ['id'=>1, 'pid'=>0, 'name'=>'顶层'],
    ['id'=>5, 'pid'=>1, 'name'=>'第一层aaa'],
    ['id'=>2, 'pid'=>1, 'name'=>'aaa222'],
    ['id'=>3, 'pid'=>1, 'name'=>'第一层bbb'],
    ['id'=>4, 'pid'=>3, 'name'=>'aaa111'],
    ['id'=>10, 'pid'=>9, 'name'=>'aaa111'],
];

$page = empty($_GET['page']) ? 1 : $_GET['page'];
$start = ($page - 1) * 1;

$data[] = $dbData[$start] ?? [];
$data[] = $dbData[$start+1] ?? [];

$res['data1'] = $data;
$res = re($res);
die($res);

function re($res) {
    $json = json_encode($res, JSON_UNESCAPED_UNICODE);
    return $json;
}