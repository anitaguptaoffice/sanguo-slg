<?php
	//玩家充值
	//参数列表：
	//uid:玩家UID
	//money:元宝(0-100000)
	//gift:礼金(0-100000)
	//wuzhu:五铢钱(0-100000)
	//copper:铜钱(0-100000)
	//返回
	//array[]:充值结果
	if (!defined("MANAGE_INTERFACE")) exit;

	$uid = isset($uid) ? intval($uid) : 0;
	if ($uid <= 1000) exit("uid_invalid");
	$user = sql_fetch_one("select uid,passport,name from sys_user where uid='$uid'");
	if (empty($user)) exit("玩家不存在");

	$money  = isset($money)  ? intval($money)  : 0;
	$gift   = isset($gift)   ? intval($gift)   : 0;
	$wuzhu  = isset($wuzhu)  ? intval($wuzhu)  : 0;
	$copper = isset($copper) ? intval($copper) : 0;

	foreach (array($money, $gift, $wuzhu, $copper) as $v) {
		if ($v < 0 || $v > 100000) exit("value_out_of_range");
	}
	if ($money == 0 && $gift == 0 && $wuzhu == 0 && $copper == 0) exit("param_empty");

	$msgs = array();
	if ($money != 0) {
		sql_query("update sys_user set money=money+'$money' where uid='$uid'");
		sql_query("insert into log_money (uid,count,time,type) values ('$uid','$money',unix_timestamp(),'888')");
		$msgs[] = "元宝+$money";
	}
	if ($gift != 0) {
		sql_query("update sys_user set gift=gift+'$gift' where uid='$uid'");
		sql_query("insert into log_gift (uid,count,time,type) values ('$uid','$gift',unix_timestamp(),'888')");
		$msgs[] = "礼金+$gift";
	}
	if ($wuzhu != 0) {
		sql_query("insert into sys_goods (uid,gid,count) values ('$uid','10960','$wuzhu') on duplicate key update `count`=`count`+'$wuzhu'");
		sql_query("insert into log_goods (uid,gid,count,time,type) values ('$uid','10960','$wuzhu',unix_timestamp(),'888')");
		$msgs[] = "五铢钱+$wuzhu";
	}
	if ($copper != 0) {
		sql_query("insert into sys_goods (uid,gid,count) values ('$uid','152','$copper') on duplicate key update `count`=`count`+'$copper'");
		sql_query("insert into log_goods (uid,gid,count,time,type) values ('$uid','152','$copper',unix_timestamp(),'888')");
		$msgs[] = "铜钱+$copper";
	}

	$ret[] = "玩家 ".$user['name']."(".$user['passport'].") 充值成功：".implode("，", $msgs);
?>