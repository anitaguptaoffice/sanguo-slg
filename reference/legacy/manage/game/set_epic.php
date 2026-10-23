<?php
	//史诗任务进度设置
	//参数列表：
	//set=1 时设置，需带 state(5=黄巾,7=董卓) 和 value；否则只读取当前值
	//  黄巾(state=5): -1未开启 0已开启 1已完成
	//  董卓(state=7): 0未开启 1已开启 2十常侍完成 3讨伐完成
	//返回
	//array[]:当前状态及设置结果
	if (!defined("MANAGE_INTERFACE")) exit;

	$epicNames = array(5 => '黄巾之乱', 7 => '讨伐董卓');
	$epicRanges = array(
		5 => array(-1 => '未开启', 0 => '已开启', 1 => '已完成'),
		7 => array(0 => '未开启', 1 => '已开启', 2 => '十常侍完成', 3 => '讨伐完成'),
	);

	if (isset($set) && $set) {
		$state = intval($state);
		$value = intval($value);
		if (!isset($epicNames[$state])) exit("state 无效（仅支持 5=黄巾, 7=董卓）");
		if (!array_key_exists($value, $epicRanges[$state])) exit("value 超出该史诗任务允许范围");
		sql_query("update mem_state set value='$value' where state='$state'");
		$ret[] = $epicNames[$state] . "史诗状态已设置为 " . $value . "（" . $epicRanges[$state][$value] . "）";
	}

	foreach (array(5, 7) as $s) {
		$cur = intval(sql_fetch_one_cell("select value from mem_state where state=$s"));
		$desc = isset($epicRanges[$s][$cur]) ? $epicRanges[$s][$cur] : '未知';
		$ret[] = $epicNames[$s] . "史诗状态=" . $cur . "（" . $desc . "）";
	}
?>
