<?php
	//恢复玩家（软删号恢复：重建登录密码，恢复删号前状态）
	//参数列表：
	//uid:玩家UID
	//password:可选，新登录密码（默认 123456，>=6位）
	//返回
	//array[]:恢复结果
	if (!defined("MANAGE_INTERFACE")) exit;

	$uid = isset($uid) ? intval($uid) : 0;
	if ($uid <= 1000) exit("uid_invalid");
	$user = sql_fetch_one("select uid,passport,name,state,bak_state from sys_user where uid='$uid'");
	if (empty($user)) exit("玩家不存在");
	if (intval($user['state']) != 4) exit("该玩家未被删除，无需恢复");

	$password = isset($password) ? trim($password) : '123456';
	if (strlen($password) < 6) exit("password_too_short");

	//重建登录密码（删号时已删除，恢复后重新写入）
	if (!sql_check("select 1 from test_passport where passport='".$user['passport']."'")) {
		sql_insert("insert into test_passport (passport,password) values ('".$user['passport']."','$password')");
	}
	//恢复删号前状态（bak_state 无记录或异常时恢复为正常 0）
	$state = intval($user['bak_state']);
	if ($state <= 0 || $state == 4) $state = 0;
	sql_query("update sys_user set state='$state', bak_state=0 where uid='$uid'");
	//重建会话/在线/引导记录（与新建玩家一致，先清理防残留）
	sql_query("delete from sys_sessions where uid='$uid'");
	sql_query("delete from sys_online where uid='$uid'");
	sql_query("delete from sys_user_comming where uid='$uid'");
	$sid = rand();
	sql_query("insert into sys_sessions (`uid`,`sid`,`ip`) values ('$uid','$sid','0.0.0.0')");
	sql_query("insert into sys_online (`uid`,`lastupdate`,`onlineupdate`,`onlinetime`) values ('$uid',unix_timestamp(),unix_timestamp(),0)");
	sql_query("insert into sys_user_comming (`uid`,`site_id`,`page_id`,`sub_page_id`) values ('$uid','0','0','0')");

	$ret[] = "玩家 ".$user['name']."(".$user['passport'].") 已恢复，登录密码已重置为 $password";
?>
