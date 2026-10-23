<?php
	// GM 后台退出登录
	if (!defined("MANAGE_INTERFACE")) exit;

	$_SESSION['gm_user'] = null;
	unset($_SESSION['gm_user']);
	$ret[] = array('status' => 'ok');
?>
