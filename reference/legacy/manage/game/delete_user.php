<?php
	//删除玩家（软删号：删除登录密码禁止再登录，标记删号状态并记录原状态，踢下线，可在玩家列表恢复）
	//参数列表：
	//uid:玩家UID
	//返回
	//array[]:删除结果
	if (!defined("MANAGE_INTERFACE")) exit;

	$uid = isset($uid) ? intval($uid) : 0;
	if ($uid <= 1000) exit("uid_invalid");
	$user = sql_fetch_one("select uid,passport,name,state from sys_user where uid='$uid'");
	if (empty($user)) exit("玩家不存在");
	if (intval($user['state']) == 4) exit("该玩家已是删号状态");

	//踢下线（session 文件真实路径 /var/www/html/server/game/sessions/）
	file_put_contents("/var/www/html/server/game/sessions/$uid", "0");
	//删除登录密码，禁止再登录
	sql_query("delete from test_passport where passport='".$user['passport']."'");
	//标记删号状态，并把删号前的状态记录到 bak_state（供恢复使用）
	sql_query("update sys_user set state=4, bak_state='".intval($user['state'])."' where uid='$uid'");
	//清理在线状态
	sql_query("delete from sys_sessions where uid='$uid'");
	sql_query("delete from sys_online where uid='$uid'");
	sql_query("delete from sys_user_comming where uid='$uid'");

	$ret[] = "玩家 ".$user['name']."(".$user['passport'].") 已删除（软删号，可在玩家列表中恢复）";
?>