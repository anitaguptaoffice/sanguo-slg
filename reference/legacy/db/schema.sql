/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `adm_goods_request` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  `reason` char(100) NOT NULL DEFAULT '',
  `adminid` int(11) NOT NULL,
  `state` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:请求中\r\n1:已经处理\r\n2:取消',
  `mesg_content` varchar(1000) NOT NULL DEFAULT '',
  `mesg_title` varchar(200) NOT NULL DEFAULT '',
  `gid` int(11) NOT NULL DEFAULT '0',
  `name` char(50) NOT NULL DEFAULT '',
  `type` char(20) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `adm_group` (
  `groupid` tinyint(4) NOT NULL DEFAULT '0',
  `purviewid` varchar(50) NOT NULL DEFAULT '',
  PRIMARY KEY (`groupid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `adm_hero_request` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `cid` int(11) NOT NULL,
  `time` int(11) NOT NULL DEFAULT '0',
  `reason` char(100) NOT NULL DEFAULT '',
  `adminid` int(11) NOT NULL,
  `state` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:请求中\r\n1:已经处理\r\n2:取消',
  `mesg_content` varchar(1000) NOT NULL DEFAULT '',
  `mesg_title` varchar(200) NOT NULL DEFAULT '',
  `hero_name` char(20) NOT NULL DEFAULT '',
  `hero_level` tinyint(4) NOT NULL DEFAULT '1',
  `hero_sex` tinyint(4) NOT NULL DEFAULT '1',
  `hero_face` int(11) NOT NULL DEFAULT '1',
  `affairs_base` tinyint(4) NOT NULL DEFAULT '30',
  `bravery_base` tinyint(4) NOT NULL DEFAULT '30',
  `wisdom_base` tinyint(4) NOT NULL DEFAULT '30',
  `loyalty` tinyint(4) NOT NULL DEFAULT '60',
  `affairs_add` tinyint(4) NOT NULL DEFAULT '30',
  `bravery_add` tinyint(4) NOT NULL DEFAULT '30',
  `wisdom_add` tinyint(4) NOT NULL DEFAULT '30',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `adm_log` (
  `adm_name` varchar(30) NOT NULL DEFAULT '',
  `opration` varchar(20) NOT NULL DEFAULT '' COMMENT 'apply_yuanbao：申请元宝；verify_yuanbao：审核元宝；make_liquan：生成礼券；send_mesg：发送系统信件',
  `opration_content` varchar(50) NOT NULL DEFAULT '',
  `oprate_time` int(11) NOT NULL DEFAULT '0',
  `id` int(11) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `adm_purview` (
  `id` int(11) NOT NULL,
  `purview` char(50) NOT NULL,
  `name` char(50) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `adm_shop_campaign` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `enable` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `name` varchar(255) NOT NULL DEFAULT '暂无' COMMENT '档期名',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `adm_shop_sale` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `enable` tinyint(4) NOT NULL DEFAULT '0' COMMENT '则规是否启用',
  `operate_type` varchar(30) NOT NULL DEFAULT '1' COMMENT '操作类型 1-打折，2-限总量，3-每人每天限购，4-每人活动期间限购，5-打包 可以多种类型组合格式：1,2,3',
  `operate_sid` int(11) NOT NULL DEFAULT '0' COMMENT '操作商品id',
  `start_time` int(11) NOT NULL DEFAULT '0' COMMENT '效生时间',
  `end_time` int(11) NOT NULL DEFAULT '0' COMMENT '束结时间',
  `campaign_id` int(11) NOT NULL DEFAULT '0' COMMENT '应对的档期号',
  `description` char(255) NOT NULL DEFAULT '' COMMENT '不做修改，为空；修改的话不为空',
  `position` int(11) NOT NULL DEFAULT '0' COMMENT '调整商品位置 暂时没有用到',
  `price` smallint(11) NOT NULL DEFAULT '10' COMMENT '商品价格',
  `rebate` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否是特价商品\r\n0：非特价\r\nN：推到特价N号位置',
  `commend` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否属于推荐商品\r\n0：不推荐\r\nN：推荐到N号位置',
  `hot` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否属于热卖商品\r\n0：非热卖\r\nN：推到热卖N号位置',
  `totalCount` int(11) NOT NULL DEFAULT '2000000000' COMMENT '该商品总量，买完为止\r\n2000000000：表示不限\r\nN表示限制N个',
  `userbuycnt` tinyint(4) NOT NULL DEFAULT '0' COMMENT '每人购买次数\r\n0：表示不限购买次数\r\nN：表示每人最多购买N次',
  `daybuycnt` tinyint(4) NOT NULL DEFAULT '0' COMMENT '每天购买次数\r\n0：不限制\r\nN：每天只能买N个',
  `onsale` tinyint(4) NOT NULL DEFAULT '1' COMMENT '品商是否上架',
  `inuse` tinyint(4) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `adm_user` (
  `userid` int(11) NOT NULL AUTO_INCREMENT,
  `group` tinyint(4) NOT NULL COMMENT '用户组',
  `username` char(30) CHARACTER SET ascii NOT NULL,
  `pwd` char(60) NOT NULL,
  `nick` char(32) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL DEFAULT '' COMMENT '理管员名称',
  `is_unin` tinyint(4) NOT NULL DEFAULT '0',
  PRIMARY KEY (`userid`)
) ENGINE=MyISAM AUTO_INCREMENT=8 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `army_request` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  `reason` char(100) NOT NULL DEFAULT '',
  `adminid` int(11) NOT NULL,
  `state` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:请求中\r\n1:已经处理\r\n2:取消',
  `cid` int(11) NOT NULL DEFAULT '0',
  `sid` int(11) NOT NULL DEFAULT '0',
  `name` varchar(20) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `bak_sys_user_battle_state` (
  `uid` int(11) NOT NULL,
  `battlefieldid` int(11) NOT NULL,
  `bid` int(11) NOT NULL,
  `unionid` int(11) NOT NULL DEFAULT '1',
  `startcid` int(11) DEFAULT '0',
  `level` int(11) NOT NULL,
  `jointime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '加入时间',
  `sent_troop_count` int(11) DEFAULT '0',
  `state` int(11) DEFAULT '0',
  `attack_win_score` int(11) DEFAULT '0',
  `finish_task_score` int(11) DEFAULT '0',
  `kill_enemy_no` int(11) DEFAULT '0',
  `be_killed_no` int(11) DEFAULT '0',
  `quittime` int(11) DEFAULT NULL,
  `iswinner` tinyint(4) DEFAULT '0',
  `gained_score` int(11) DEFAULT '0' COMMENT '在这个跨服战场中得到的总积分',
  PRIMARY KEY (`uid`,`battlefieldid`),
  KEY `idx_bid_unionid` (`battlefieldid`,`unionid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `bak_troops` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL COMMENT '玩家',
  `cid` int(11) NOT NULL COMMENT '城池',
  `hid` int(11) NOT NULL COMMENT '将领',
  `targetcid` int(11) NOT NULL DEFAULT '0' COMMENT '目标地点',
  `task` tinyint(4) NOT NULL DEFAULT '0',
  `state` smallint(6) NOT NULL DEFAULT '0',
  `starttime` int(11) NOT NULL DEFAULT '0' COMMENT '出发时间',
  `pathtime` int(11) NOT NULL DEFAULT '0',
  `endtime` int(11) NOT NULL DEFAULT '0' COMMENT '结束时间',
  `noback` tinyint(4) NOT NULL DEFAULT '0' COMMENT '中了关门打狗，不能回去',
  `soldiers` char(255) CHARACTER SET ascii NOT NULL DEFAULT '0' COMMENT '士兵，格式为\r\nnum:sid,cnt;sid,cnt....',
  `resource` char(255) CHARACTER SET ascii NOT NULL DEFAULT '0' COMMENT '携带资源 黄金,粮食,木材,石料,铁锭',
  `battleid` int(11) NOT NULL DEFAULT '0' COMMENT '发生战斗时的战斗ＩＤ',
  `people` int(11) NOT NULL DEFAULT '0' COMMENT '军队占用人口数',
  `fooduse` double NOT NULL DEFAULT '0',
  `lastrun` int(11) NOT NULL DEFAULT '0' COMMENT '上一次使用金蝉脱壳的时间',
  `lastlock` int(11) NOT NULL DEFAULT '0' COMMENT '上一次中八门金锁的时间',
  `lastTempt` int(11) NOT NULL DEFAULT '0',
  `lastacc` int(11) NOT NULL DEFAULT '0',
  `battlefieldid` int(11) NOT NULL DEFAULT '0',
  `startcid` int(11) NOT NULL DEFAULT '0',
  `battleunionid` int(11) NOT NULL DEFAULT '0',
  `targettroopid` int(11) NOT NULL DEFAULT '0',
  `drop` char(100) NOT NULL DEFAULT '',
  `rate` smallint(6) NOT NULL DEFAULT '0',
  `bid` int(11) NOT NULL,
  `arrive_time` int(11) DEFAULT '0',
  `ulimit` int(11) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `endtime` (`endtime`),
  KEY `state` (`state`),
  KEY `idx_targetcid` (`targetcid`)
) ENGINE=MyISAM AUTO_INCREMENT=568 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_achivement` (
  `id` int(11) NOT NULL,
  `group` int(11) NOT NULL DEFAULT '0',
  `sub_group` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL DEFAULT '',
  `content` varchar(255) CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL,
  `todo` varchar(255) CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL,
  `image` varchar(255) CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL,
  `type` int(11) NOT NULL DEFAULT '0',
  `condition` int(11) NOT NULL DEFAULT '0',
  `point` int(11) NOT NULL DEFAULT '0',
  `count` int(11) NOT NULL DEFAULT '0',
  `state` int(11) DEFAULT '1',
  `open_time` varchar(32) CHARACTER SET utf8 COLLATE utf8_bin DEFAULT '0',
  `sql_current_value` varchar(512) CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL,
  `target_value` int(11) DEFAULT '0',
  `union_inform` int(11) DEFAULT '0',
  `system_inform` int(11) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_achivement_goal` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `content` varchar(128) COLLATE utf8_bin DEFAULT NULL,
  `sql_check_goal` varchar(512) COLLATE utf8_bin DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=103 DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_achivement_goal_mapping` (
  `achivement_id` int(11) NOT NULL,
  `achivement_goal_id` int(11) NOT NULL,
  PRIMARY KEY (`achivement_id`,`achivement_goal_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_achivement_group` (
  `id` int(11) NOT NULL,
  `name` varchar(64) COLLATE utf8_bin DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_act` (
  `actid` int(11) NOT NULL AUTO_INCREMENT,
  `starttime` int(11) NOT NULL DEFAULT '0' COMMENT '活动开始时间',
  `endtime` int(11) NOT NULL DEFAULT '2000000000' COMMENT '活动结束时间',
  `rate` tinyint(3) DEFAULT '0' COMMENT '触发概率， 以100为单位， 15表示 15%的概率触发该事件',
  `name` varchar(255) DEFAULT NULL COMMENT '活动名称',
  `type` int(11) DEFAULT '0' COMMENT '活动类型, 0:寻宝活动 1:客栈刷将领 2:充值活动 3:乐透活动 4:击败张角概率掉落 5:官渡掉落 6:战场勋章掉落增加 7:战斗效果加成 8:历练',
  `totalcount` int(11) NOT NULL DEFAULT '0',
  `daycount` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`actid`)
) ENGINE=MyISAM AUTO_INCREMENT=4365 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_act_battle` (
  `actid` int(11) NOT NULL,
  `date` int(11) NOT NULL COMMENT '日期(0：为每周定期，>0：为临时手动添加)',
  `actname` varchar(32) NOT NULL,
  `acttime` varchar(32) NOT NULL,
  `starthour` tinyint(4) NOT NULL,
  `endhour` tinyint(4) NOT NULL,
  `rate` tinyint(4) NOT NULL DEFAULT '1' COMMENT '倍率',
  `state` tinyint(4) NOT NULL COMMENT '战场活动状态:0不上，1全部开启，2部分开启（到cfg_act_battle_details里找）',
  PRIMARY KEY (`actid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='战场每周活动';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_act_battle_details` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `actid` int(11) NOT NULL COMMENT '战场倍率活动id',
  `bid` int(11) NOT NULL COMMENT '开启活动的战场id',
  PRIMARY KEY (`id`),
  KEY `actid` (`actid`)
) ENGINE=MyISAM AUTO_INCREMENT=6 DEFAULT CHARSET=utf8 COMMENT='战场活动明细';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_act_fight` (
  `actid` int(11) NOT NULL,
  `hid` int(11) NOT NULL,
  PRIMARY KEY (`actid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_act_hero_expr` (
  `id` int(11) NOT NULL COMMENT '活动历练ID',
  `actid` int(11) NOT NULL,
  `type` int(11) NOT NULL COMMENT '练历类型',
  `qid` int(11) NOT NULL COMMENT '奇遇ID',
  `money` int(11) NOT NULL DEFAULT '0' COMMENT '奇遇花费元宝数',
  `hours` tinyint(4) NOT NULL DEFAULT '0' COMMENT '奇遇最小需要小时数',
  `rate` smallint(6) NOT NULL DEFAULT '0',
  `oncecount` smallint(6) NOT NULL DEFAULT '0' COMMENT '该奇遇活动期间发生上限',
  `totalcount` smallint(6) NOT NULL DEFAULT '0' COMMENT '所有奇遇活动期间发生上限',
  `description` char(255) NOT NULL DEFAULT '' COMMENT '奇遇描述',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_act_hero_summon` (
  `herotype` int(11) NOT NULL COMMENT '活动将领类型,唯一指定一个活动将',
  `sort` int(11) NOT NULL DEFAULT '0' COMMENT '物品类别 2：宝物//5：任务//6：装备',
  `type` int(11) NOT NULL DEFAULT '0' COMMENT '物品类型ID',
  `name` char(20) NOT NULL,
  `count` int(11) NOT NULL DEFAULT '1'
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_act_paygift` (
  `actid` int(11) NOT NULL DEFAULT '0',
  `money_limit` int(11) DEFAULT '0' COMMENT '最少充值money_limit个元宝才可以赠送',
  `daycnt` int(11) DEFAULT '0' COMMENT '最少充值money_limit个元宝才可以赠送',
  `mailtitle` char(128) NOT NULL DEFAULT '' COMMENT '信件标题',
  `mailcontent` text NOT NULL COMMENT '信件内容',
  `max_money_limit` int(11) NOT NULL DEFAULT '0' COMMENT '元宝上限\r\n0:表示无上限，多充多得\r\n2000000000：表示最大值',
  PRIMARY KEY (`actid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='充值送礼活动';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_act_shopgift` (
  `actid` int(11) NOT NULL DEFAULT '0',
  `money_limit` int(11) DEFAULT '0' COMMENT '最少消费money_limit个元宝才可以赠送',
  `max_money_limit` int(11) NOT NULL DEFAULT '2000000000' COMMENT '元宝上限\r\n2000000000：表示不限',
  PRIMARY KEY (`actid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_act_task_good_drop` (
  `id` int(7) NOT NULL AUTO_INCREMENT COMMENT 'id标记',
  `actiontype` int(11) NOT NULL DEFAULT '0' COMMENT '操作类型，是哪种操作，如1表示每日签到，2表示参加战场',
  `actid` int(11) DEFAULT '0' COMMENT '动活id',
  `sort` tinyint(4) DEFAULT NULL COMMENT '品物的sort，和cfg——reward的sort一样',
  `type` int(11) DEFAULT NULL COMMENT '品物的type，和cfg——reward的一样',
  `count` int(11) DEFAULT '0' COMMENT '励奖此物品的个数',
  `name` varchar(100) DEFAULT ' ' COMMENT '奖励描述',
  `rate` tinyint(3) DEFAULT '100' COMMENT '此奖励是否给的概率，100表示一定，0表示一定不给',
  `param` varchar(30) DEFAULT '0' COMMENT '附加参数，例如需要多长时间才掉落此物品啊之类,如果比param小将不给',
  `starttime` int(11) DEFAULT '0' COMMENT '始开掉时间',
  `endtime` int(11) DEFAULT '0' COMMENT '束结掉时间',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=22 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_act_union_gains` (
  `detail_id` int(11) NOT NULL COMMENT '获得明细ID',
  `union_id` int(11) NOT NULL DEFAULT '0' COMMENT '联盟ID',
  `count` int(11) NOT NULL DEFAULT '0' COMMENT '获得总数量',
  UNIQUE KEY `detail_union_id` (`detail_id`,`union_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_act_union_reward` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tid` int(11) NOT NULL COMMENT '联盟任务id',
  `sort` int(11) NOT NULL DEFAULT '0' COMMENT '奖励物品类型',
  `type` int(11) NOT NULL DEFAULT '0' COMMENT '奖励类型ID',
  `count` int(11) NOT NULL DEFAULT '0' COMMENT '奖励数量',
  `description` char(255) NOT NULL DEFAULT '奖励描述',
  PRIMARY KEY (`id`),
  KEY `sort` (`sort`),
  KEY `idx_tid` (`tid`)
) ENGINE=MyISAM AUTO_INCREMENT=15 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_act_union_task` (
  `id` int(11) NOT NULL COMMENT '联盟任务id',
  `detail_id` int(11) NOT NULL DEFAULT '0' COMMENT '获得物品明细id',
  `count` int(11) NOT NULL DEFAULT '0' COMMENT '达到目标数量',
  `description` char(255) NOT NULL DEFAULT '联盟任务物品',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_activity_rank` (
  `actid` int(11) NOT NULL COMMENT '活动ID，参考cfg_act',
  `starttime` int(11) NOT NULL DEFAULT '0' COMMENT '排行活动开始时间',
  `endtime` int(11) NOT NULL COMMENT '活动结束时间',
  `reward_endtime` int(11) NOT NULL COMMENT '可以领奖的时间，过了这个时间，这个榜单会被清理掉',
  `desc` varchar(255) NOT NULL COMMENT '活动说明',
  `title` char(64) NOT NULL COMMENT '行列排',
  `sql` varchar(1024) NOT NULL DEFAULT '' COMMENT '生成排行的SQL语句',
  `day_sql` varchar(1024) NOT NULL DEFAULT '' COMMENT '日排行的SQL语句',
  PRIMARY KEY (`actid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_activity_rank_reward` (
  `actid` int(11) NOT NULL COMMENT '活动ID，参考cfg_activity_rank',
  `minrank` int(11) NOT NULL COMMENT '该档最低名次',
  `maxrank` int(11) NOT NULL COMMENT '该档最高名次',
  `reward` varchar(255) NOT NULL COMMENT '该档奖励，跟礼券一样的规则',
  PRIMARY KEY (`actid`,`minrank`,`maxrank`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_activity_rank_reward_day` (
  `actid` int(11) NOT NULL COMMENT '活动ID，参考cfg_activity_rank',
  `day` tinyint(4) NOT NULL COMMENT '活动第几日',
  `minrank` int(11) NOT NULL COMMENT '该档最低名次',
  `maxrank` int(11) NOT NULL COMMENT '该档最高名次',
  `reward` varchar(255) NOT NULL COMMENT '该档奖励，跟礼券一样的规则',
  PRIMARY KEY (`actid`,`day`,`minrank`,`maxrank`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_armor` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(32) NOT NULL,
  `part` tinyint(4) NOT NULL COMMENT '部件\r\n1：头部\r\n2：颈部\r\n3：肩部\r\n4：胸部\r\n5：背部\r\n6：腰部\r\n7：手臂\r\n8：脚部\r\n9：手指\r\n10：饰品\r\n11：武器\r\n12：坐骑',
  `type` tinyint(4) NOT NULL DEFAULT '0' COMMENT '装备类别\r\n1：灰装\r\n2：白装\r\n3：绿装\r\n4：蓝装\r\n5：紫装\r\n6：橙装\r\n7：红装',
  `attribute` char(255) NOT NULL DEFAULT '0' COMMENT '装备属性\r\nN,type,value,type,value,type,value....\r\ntype说明\r\n1：统帅\r\n2：内政\r\n3：勇武\r\n4：智谋\r\n5：体力\r\n6：精力\r\n7：生命\r\n8：攻击\r\n9：防御\r\n10：射程\r\n11：速度\r\n12：负重',
  `hero_level` tinyint(4) NOT NULL DEFAULT '1' COMMENT '要求武将最低等级',
  `ori_hp_max` smallint(6) NOT NULL DEFAULT '100' COMMENT '装备的最大耐久',
  `value` smallint(6) NOT NULL DEFAULT '20' COMMENT '备装的价值',
  `image` int(11) NOT NULL DEFAULT '0',
  `inuse` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否撤用',
  `box_drop` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否会宝箱掉落，０表示用不掉落，１表示会掉落',
  `battle_drop` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否会战斗掉落，０表示用不掉落，１表示会掉落',
  `description` varchar(255) NOT NULL DEFAULT '' COMMENT '描述',
  `special` varchar(255) DEFAULT NULL,
  `level` int(11) DEFAULT '0' COMMENT '等级',
  `bid` int(11) DEFAULT '0',
  `tieid` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=130012 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_armor_attribute` (
  `armorid` int(11) NOT NULL COMMENT '装备id',
  `attid` int(11) NOT NULL COMMENT '属性id',
  `value` int(11) NOT NULL COMMENT '属性值',
  UNIQUE KEY `idx_attid_armorid` (`attid`,`armorid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_armor_hole_rule` (
  `id` int(11) NOT NULL,
  `rule` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_armor_level_attr` (
  `level` int(11) NOT NULL DEFAULT '0',
  `attr` varchar(255) NOT NULL DEFAULT '0' COMMENT 'ARMATT_COMMAND=1,\r\nARMATT_AFFAIRS=2,\r\nARMATT_BRAVERY=3,\r\nARMATT_WISDOM=4,\r\nARMATT_FORCE=5,\r\nARMATT_ENERGY=6,\r\nARMATT_HP=7,\r\nARMATT_AP=8,\r\nARMATT_DP=9,\r\nARMATT_RANGE=10,\r\nARMATT_SPEED=11,\r\nARMATT_CARRY=12,',
  PRIMARY KEY (`level`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_assemble_reward` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(30) NOT NULL COMMENT '奖励名称',
  `gid` int(11) NOT NULL COMMENT '奖励物品gid',
  `base` int(11) NOT NULL DEFAULT '0' COMMENT '奖励基数',
  `type` int(11) NOT NULL DEFAULT '0' COMMENT '0物品，1装备，2资源',
  `rate` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=8 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_assemble_special_hero` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `battleid` int(11) NOT NULL DEFAULT '0' COMMENT '对应过关斩将精英难度楼层数',
  `type` int(11) NOT NULL DEFAULT '0' COMMENT '将领的品质，和君主将的修为匹配',
  `rate` int(11) NOT NULL DEFAULT '0',
  `rewardid` int(11) NOT NULL DEFAULT '0',
  `rewardcount` int(11) NOT NULL DEFAULT '0',
  `isopen` int(11) NOT NULL DEFAULT '0' COMMENT '当前刷出来的将领',
  PRIMARY KEY (`id`),
  KEY `idx_battleid` (`battleid`)
) ENGINE=MyISAM AUTO_INCREMENT=8 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_attribute` (
  `attid` int(11) NOT NULL COMMENT '属性id',
  `type` int(11) NOT NULL COMMENT '属性类型',
  `name` varchar(255) NOT NULL COMMENT '属性名称',
  `summary` varchar(255) NOT NULL COMMENT '属性大概描述',
  `detail` varchar(255) NOT NULL COMMENT '属性详细描述',
  `low` int(11) DEFAULT NULL COMMENT '最低可能出现的属性值',
  `high` int(11) DEFAULT NULL COMMENT '最高可能出现的属性值',
  PRIMARY KEY (`attid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_baned_ip` (
  `ip` int(11) NOT NULL,
  PRIMARY KEY (`ip`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_baned_mail_content` (
  `content` char(32) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL,
  PRIMARY KEY (`content`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_baned_name` (
  `name` char(50) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_battle_city` (
  `bid` int(11) NOT NULL DEFAULT '0',
  `xy` int(11) NOT NULL,
  `nextxy` char(255) NOT NULL DEFAULT '0',
  `drop` char(255) NOT NULL DEFAULT '-1' COMMENT '落掉哪种类型 1 宝物 2 装备 3 东西',
  `unionid` int(11) NOT NULL DEFAULT '-1' COMMENT '阵营ID',
  `rate` smallint(6) NOT NULL DEFAULT '0',
  `name` char(50) NOT NULL DEFAULT '',
  `image` tinyint(4) NOT NULL DEFAULT '0',
  `winpoint` int(11) NOT NULL DEFAULT '0',
  `losepoint` int(11) NOT NULL DEFAULT '0',
  `position` int(11) DEFAULT NULL,
  `reinforce_soldiers` varchar(255) DEFAULT NULL,
  `can_quest` tinyint(4) DEFAULT '0',
  PRIMARY KEY (`bid`,`xy`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_battle_event` (
  `triggerid` int(11) NOT NULL COMMENT '触发者ID 可以是 军队 或者 据点',
  `triggertype` int(11) NOT NULL COMMENT '0 军队完成任务 1 据点完成任务 2 军队触发我方任务  3 据点触发敌方任务 4 触发军队重生时间',
  `targetid1` int(11) NOT NULL DEFAULT '0',
  `unionid` int(11) NOT NULL,
  `targettype` int(11) NOT NULL,
  `bid` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `msg` text NOT NULL,
  `targetid2` int(11) NOT NULL DEFAULT '0',
  `triggercount` tinyint(4) DEFAULT '0',
  `targettype2` int(11) DEFAULT '0',
  `targetid1_option` varchar(255) DEFAULT '',
  `targetid2_option` varchar(255) DEFAULT '',
  `fail_msg` varchar(255) DEFAULT '',
  `dialog_inform` tinyint(4) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `btuIdx` (`bid`,`triggertype`,`unionid`)
) ENGINE=MyISAM AUTO_INCREMENT=1229 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_battle_field` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(30) NOT NULL,
  `type` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:剧情，1:据点',
  `maxpeople` smallint(6) NOT NULL DEFAULT '5' COMMENT '最大人数',
  `content` varchar(500) NOT NULL COMMENT '战场说明',
  `maxlevel` smallint(6) NOT NULL DEFAULT '20' COMMENT '最高等级',
  `todo` varchar(100) NOT NULL COMMENT '战场指南',
  `reward` varchar(100) NOT NULL,
  `union_count` smallint(6) NOT NULL DEFAULT '0' COMMENT '势力个数',
  `state` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0 未开放 1 玩家开放中 2 系统开放中',
  `maxtime` int(11) NOT NULL,
  `minpeople` smallint(6) NOT NULL,
  `maxcount` smallint(6) NOT NULL DEFAULT '100',
  `maxdaycount` smallint(6) NOT NULL DEFAULT '5',
  `user_unionid` smallint(6) DEFAULT '0' COMMENT '玩家所属阵营',
  `openCondition` varchar(500) NOT NULL DEFAULT ' ' COMMENT '战场开启条件说明',
  `demandGoods` varchar(100) NOT NULL DEFAULT ',' COMMENT '战场门票（针对goods表）',
  `demandThings` varchar(100) NOT NULL DEFAULT ',' COMMENT '战场门票（针对things表）',
  `demandNobility` int(11) NOT NULL DEFAULT '0' COMMENT '战场爵位要求',
  `openTime` int(11) NOT NULL DEFAULT '0' COMMENT '用于战场在一定时间后强制开启',
  `joinDemand` varchar(100) NOT NULL DEFAULT ' ' COMMENT '加入要求',
  `battleTicket` varchar(100) NOT NULL DEFAULT ' ' COMMENT '战场门票',
  `winCondition` varchar(200) NOT NULL DEFAULT ' ' COMMENT '胜利条件',
  `loseCondition` varchar(200) NOT NULL DEFAULT ' ' COMMENT '失败条件',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=12002 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_battle_hero` (
  `bid` int(11) NOT NULL COMMENT '英雄ID',
  `name` char(16) NOT NULL DEFAULT '' COMMENT '名字',
  `sex` tinyint(4) NOT NULL,
  `face` smallint(6) NOT NULL,
  `level` smallint(6) NOT NULL DEFAULT '1' COMMENT '级别',
  `command` smallint(6) NOT NULL DEFAULT '0' COMMENT '领将的统率',
  `affairs` smallint(6) NOT NULL DEFAULT '0' COMMENT '内政',
  `bravery` smallint(6) NOT NULL DEFAULT '0' COMMENT '勇武',
  `wisdom` smallint(6) NOT NULL DEFAULT '0' COMMENT '智谋',
  `hid` int(11) NOT NULL AUTO_INCREMENT,
  `energy` smallint(6) NOT NULL DEFAULT '0',
  `force` smallint(6) NOT NULL DEFAULT '0',
  `rangeadd` smallint(6) NOT NULL DEFAULT '0',
  `speedadd` smallint(6) NOT NULL DEFAULT '0',
  `armor_drop_type` smallint(6) DEFAULT '0',
  `can_chat` tinyint(4) DEFAULT '0',
  `no_attack` tinyint(4) DEFAULT '0',
  `npc_hero_id` int(11) DEFAULT '0' COMMENT '对应的cfg_npc_hero中的id',
  PRIMARY KEY (`hid`)
) ENGINE=MyISAM AUTO_INCREMENT=8065 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_battle_start_city` (
  `bid` int(11) NOT NULL,
  `xy` int(11) NOT NULL,
  `name` char(50) NOT NULL DEFAULT '',
  `unionid` int(11) NOT NULL,
  `needhonour` int(11) NOT NULL,
  PRIMARY KEY (`bid`,`xy`,`unionid`),
  KEY `bid_unionid` (`bid`,`unionid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_battle_troop` (
  `bid` int(11) NOT NULL DEFAULT '0',
  `xy` int(11) NOT NULL,
  `drop` char(255) NOT NULL DEFAULT '',
  `rate` smallint(6) NOT NULL DEFAULT '0',
  `hid` int(11) NOT NULL,
  `npcvalue` int(11) NOT NULL,
  `soldiers` char(50) NOT NULL,
  `type` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:初始军，1: 重生军',
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `unionid` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `bid_cid` (`bid`,`xy`)
) ENGINE=MyISAM AUTO_INCREMENT=1607 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_battle_union` (
  `bid` int(11) NOT NULL,
  `unionid` int(11) NOT NULL,
  `name` char(30) DEFAULT '',
  `flag` char(10) DEFAULT '',
  `taskgroup` varchar(50) DEFAULT '',
  `init_tasks` varchar(255) DEFAULT NULL,
  `metal_gid` int(11) DEFAULT '0',
  `taskthing` varchar(255) DEFAULT '0',
  PRIMARY KEY (`unionid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_battle_winpoint` (
  `bid` int(11) NOT NULL,
  `unionid` int(11) NOT NULL,
  `startpoint` int(11) NOT NULL,
  `name` char(50) NOT NULL DEFAULT '',
  `totalpoint` int(11) DEFAULT '0',
  PRIMARY KEY (`bid`,`unionid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_battlenet_server` (
  `bid` int(11) NOT NULL,
  `url` varchar(255) NOT NULL,
  `chatport` smallint(6) NOT NULL,
  `chathost` varchar(255) NOT NULL,
  `neturl` varchar(255) NOT NULL,
  PRIMARY KEY (`bid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_bigcity_npcvalue` (
  `cid` int(11) NOT NULL,
  `npcvalue` int(11) NOT NULL,
  PRIMARY KEY (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_book` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `level` int(11) NOT NULL,
  `skill` int(10) NOT NULL DEFAULT '0' COMMENT '书对应的技能id',
  `attr` int(11) NOT NULL,
  `description` varchar(255) NOT NULL,
  `attr_type` tinyint(4) NOT NULL,
  UNIQUE KEY `idx_id_level` (`id`,`level`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_book_rate` (
  `level` smallint(5) NOT NULL,
  `rate` smallint(5) NOT NULL,
  PRIMARY KEY (`level`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_box_combine_details` (
  `id` int(11) NOT NULL,
  `boxid` int(11) NOT NULL DEFAULT '0',
  `goodsid` int(11) NOT NULL DEFAULT '0',
  `count` int(11) NOT NULL DEFAULT '0',
  `rate` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_box_details` (
  `srctype` int(11) DEFAULT '0' COMMENT '0:对应cfg_goods',
  `srcid` int(11) NOT NULL DEFAULT '0' COMMENT 'srctype=0时道具ID, 对应cfg_goods中的gid，srctype=1时,对应cfg_act对应宝藏开出的id',
  `sort` tinyint(4) NOT NULL DEFAULT '0' COMMENT '1:资源\r\n2:宝物\r\n3:军队\r\n4:城防\r\n5:任务物品\r\n6:装备',
  `type` int(11) NOT NULL DEFAULT '0',
  `count` int(11) DEFAULT '1',
  `rate` int(11) DEFAULT '0' COMMENT '如果是联盟充值活动则为金额标准',
  `inform` tinyint(3) DEFAULT '0' COMMENT '0:表示不发通知 1：发通知',
  `dayopencount` int(11) NOT NULL DEFAULT '0',
  `totalopencount` int(11) NOT NULL DEFAULT '0',
  `owncount` int(11) NOT NULL DEFAULT '0',
  `id` int(11) NOT NULL DEFAULT '0',
  `name` varchar(256) DEFAULT NULL,
  `temp` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_box_open_condition` (
  `boxid` int(11) DEFAULT NULL COMMENT '宝箱gid',
  `keyid` varchar(255) DEFAULT NULL COMMENT '钥匙描述',
  `noboxdesc` varchar(255) DEFAULT NULL COMMENT '没有宝箱描述',
  `nokeydesc` varchar(255) DEFAULT NULL COMMENT '没有钥匙描述',
  UNIQUE KEY `boxid` (`boxid`),
  UNIQUE KEY `keyid` (`keyid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='打开宝箱需要钥匙';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_building` (
  `bid` int(11) NOT NULL,
  `name` char(100) NOT NULL,
  `table_name` char(100) NOT NULL,
  `description` char(255) NOT NULL,
  `inner` tinyint(4) NOT NULL DEFAULT '0',
  PRIMARY KEY (`bid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='建筑的设定';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_building_condition` (
  `bid` int(11) NOT NULL,
  `levelid` int(11) NOT NULL,
  `pre_type` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:building; 1:technic;2:goods',
  `pre_id` int(11) NOT NULL DEFAULT '0',
  `pre_level` int(11) NOT NULL DEFAULT '0',
  KEY `bid_level` (`bid`,`levelid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='建造建筑的前提条件';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_building_level` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bid` int(11) NOT NULL,
  `level` int(11) NOT NULL,
  `upgrade_wood` double(11,0) NOT NULL DEFAULT '0',
  `upgrade_rock` double(11,0) NOT NULL DEFAULT '0',
  `upgrade_iron` double(11,0) NOT NULL DEFAULT '0',
  `upgrade_food` double(11,0) NOT NULL DEFAULT '0',
  `upgrade_gold` double(11,0) NOT NULL DEFAULT '0',
  `upgrade_people` int(11) NOT NULL,
  `upgrade_time` int(11) NOT NULL DEFAULT '0',
  `using_people` int(11) NOT NULL DEFAULT '0',
  `description` char(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bid_level` (`bid`,`level`)
) ENGINE=MyISAM AUTO_INCREMENT=321 DEFAULT CHARSET=utf8 COMMENT='建筑的级别设定';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_building_merge` (
  `bid` int(11) NOT NULL,
  `seq` int(11) NOT NULL,
  PRIMARY KEY (`bid`),
  UNIQUE KEY `seq` (`seq`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='合并建筑的升级顺序';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_city_npcvalue` (
  `level` int(11) NOT NULL AUTO_INCREMENT,
  `npcvalue` int(11) NOT NULL,
  PRIMARY KEY (`level`)
) ENGINE=MyISAM AUTO_INCREMENT=11 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_city_prestige` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `prestige` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=101 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_city_tactics` (
  `stype` tinyint(4) NOT NULL AUTO_INCREMENT,
  `deplunder_join` tinyint(4) NOT NULL COMMENT '1:参加,2:留守',
  `deplunder_action` tinyint(4) NOT NULL COMMENT '１：进攻２：防御３：后退',
  `deplunder_target` tinyint(4) NOT NULL COMMENT '目标',
  `depatrol_join` tinyint(4) NOT NULL,
  `depatrol_action` tinyint(4) NOT NULL,
  `deinvade_join` tinyint(4) NOT NULL,
  `deinvade_action` tinyint(4) NOT NULL,
  `deinvade_target` tinyint(4) NOT NULL,
  `deinvade_action2` tinyint(4) NOT NULL,
  `deinvade_target2` tinyint(4) NOT NULL,
  PRIMARY KEY (`stype`)
) ENGINE=MyISAM AUTO_INCREMENT=51 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_common` (
  `id` int(11) NOT NULL,
  `param1` int(11) NOT NULL DEFAULT '0',
  `param2` int(11) NOT NULL DEFAULT '0',
  `param3` int(11) NOT NULL DEFAULT '0',
  `param4` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MEMORY DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_count_desc` (
  `count` int(11) NOT NULL,
  `desc` char(30) NOT NULL,
  PRIMARY KEY (`count`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_defence` (
  `did` int(11) NOT NULL AUTO_INCREMENT,
  `type` int(11) NOT NULL,
  `name` char(100) NOT NULL,
  `description` char(255) NOT NULL,
  `hp` int(11) NOT NULL DEFAULT '0' COMMENT '生命',
  `ap` int(11) NOT NULL DEFAULT '0' COMMENT '攻击',
  `dp` int(11) NOT NULL DEFAULT '0' COMMENT '防御',
  `range` int(11) NOT NULL DEFAULT '0',
  `speed` int(11) NOT NULL DEFAULT '0',
  `carry` int(11) NOT NULL DEFAULT '0',
  `time_need` int(11) NOT NULL DEFAULT '0',
  `wood_need` double NOT NULL DEFAULT '0',
  `rock_need` double NOT NULL DEFAULT '0',
  `iron_need` double NOT NULL DEFAULT '0',
  `food_need` double NOT NULL DEFAULT '0',
  `gold_need` double NOT NULL DEFAULT '0',
  `area_need` tinyint(4) NOT NULL DEFAULT '1',
  PRIMARY KEY (`did`)
) ENGINE=MyISAM AUTO_INCREMENT=6 DEFAULT CHARSET=utf8 COMMENT='建筑的设定';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_defence_condition` (
  `did` int(11) NOT NULL,
  `pre_type` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:building; 1:technic',
  `pre_id` int(11) NOT NULL DEFAULT '0',
  `pre_level` int(11) NOT NULL DEFAULT '0',
  KEY `bid_level` (`did`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='建造建筑的前提条件';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_designation` (
  `did` int(10) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` varchar(255) NOT NULL,
  `condition` char(255) NOT NULL,
  `type` int(11) NOT NULL COMMENT '0：非永久，1：永久',
  PRIMARY KEY (`did`)
) ENGINE=MyISAM AUTO_INCREMENT=27 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_field_npcvalue` (
  `level` int(11) NOT NULL AUTO_INCREMENT,
  `npcvalue` int(11) NOT NULL,
  PRIMARY KEY (`level`)
) ENGINE=MyISAM AUTO_INCREMENT=13 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_goods` (
  `gid` int(11) NOT NULL COMMENT '道具ID\r\n500000以上表示自动生产的礼包',
  `name` char(30) NOT NULL COMMENT '名称',
  `inuse` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否在使用中',
  `battle` smallint(6) NOT NULL DEFAULT '0',
  `copperbox` smallint(6) NOT NULL DEFAULT '0',
  `silverbox` smallint(6) NOT NULL DEFAULT '0',
  `goldbox` smallint(6) NOT NULL DEFAULT '0',
  `woodbox` smallint(6) NOT NULL DEFAULT '0',
  `lovebean` smallint(6) NOT NULL DEFAULT '0',
  `value` int(11) NOT NULL DEFAULT '1',
  `group` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:宝物类\r\n1:加速类\r\n2:生产类\r\n3:宝箱类\r\n4:珠宝类\r\n5:任务类',
  `image` int(11) NOT NULL DEFAULT '0' COMMENT '道具的图片\r\n0：默认规则下的图片\r\nN：pack_N.png',
  `description` char(255) NOT NULL,
  `position` int(11) NOT NULL DEFAULT '0',
  `useguide` varchar(255) NOT NULL DEFAULT '' COMMENT '使用说明',
  `treasurebox` smallint(6) NOT NULL DEFAULT '0',
  `autouse` tinyint(4) NOT NULL DEFAULT '1' COMMENT '能否在宝物界面直接使用',
  `zuoji_type` int(11) DEFAULT '0' COMMENT '1:盔类, 2:甲类, 3:鞍类, 4:绳类, 5:脚类',
  `level` int(11) DEFAULT '0' COMMENT '等级',
  `attr` varchar(255) DEFAULT '' COMMENT '比如1,2,2,2 表示统帅+2 内政+2',
  `imagetype` smallint(6) DEFAULT '0' COMMENT '1:将领头像image=x对应hero_boy_x.jpg',
  PRIMARY KEY (`gid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_goods_copper` (
  `gid` int(11) NOT NULL,
  `price` int(11) NOT NULL,
  `rate` int(11) NOT NULL,
  `type` int(11) NOT NULL,
  `onsale` tinyint(11) NOT NULL DEFAULT '1' COMMENT '是否上架',
  `commend` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否属于推荐商品\r\n0：不推荐\r\n1：不推荐',
  UNIQUE KEY `idx_gid_type` (`gid`,`type`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_goods_drop` (
  `gid` int(11) NOT NULL DEFAULT '0',
  `act` int(5) DEFAULT '0' COMMENT '在哪用这个物品',
  `count` int(5) DEFAULT '0' COMMENT '多少个',
  `type` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是什么东西，1宝物，\r\r\n2thing，3装备',
  `starttime` int(11) DEFAULT '0' COMMENT '开启时间',
  `endtime` int(11) DEFAULT '0' COMMENT '结束时间',
  PRIMARY KEY (`type`,`gid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_goods_timeout` (
  `gid` int(11) NOT NULL COMMENT '道具ID\r\n50000以上表示自动生产的礼包',
  `endtime` int(11) NOT NULL DEFAULT '0' COMMENT '该宝物过期时间',
  `type` smallint(6) NOT NULL DEFAULT '0' COMMENT '0 商品 1 任务 2 任务物品',
  PRIMARY KEY (`gid`),
  UNIQUE KEY `gid_type` (`gid`,`type`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_guide` (
  `gid` int(11) NOT NULL,
  `group` int(11) NOT NULL DEFAULT '1' COMMENT '引导类别',
  `pregid` int(11) NOT NULL DEFAULT '0',
  `name` char(50) NOT NULL,
  `content` text NOT NULL COMMENT '引导提示内容',
  `triggertype` smallint(6) NOT NULL DEFAULT '0' COMMENT '触发条件 1：使用某个宝箱时',
  `triggerdetails` varchar(256) DEFAULT NULL COMMENT '消失条件详细设置 disType=1,内容：leftTopX,leftTopY,width,height ',
  `showpos` varchar(256) NOT NULL COMMENT '显示的位置D,X,Y表示方向,X坐标,Y坐标,D: 1向上 2，向右，3向下，4向左',
  `distype` smallint(6) NOT NULL DEFAULT '0' COMMENT '消失类型 1：点击界面上的方形区域时',
  `disdetails` varchar(256) DEFAULT NULL COMMENT '消失条件详细设置 disType=1,内容：leftTopX,leftTopY,width,height ',
  PRIMARY KEY (`gid`),
  KEY `idx_group` (`group`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='引导\n';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_guide_group` (
  `id` int(11) NOT NULL,
  `name` char(255) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='引导类别';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_hero` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(15) NOT NULL,
  `npcid` smallint(6) NOT NULL DEFAULT '0',
  `sex` tinyint(4) NOT NULL DEFAULT '0',
  `face` smallint(6) NOT NULL DEFAULT '0',
  `cid` int(11) NOT NULL DEFAULT '0',
  `level` tinyint(4) NOT NULL DEFAULT '0',
  `exp` double NOT NULL DEFAULT '0',
  `affairs_add` smallint(6) NOT NULL DEFAULT '0',
  `bravery_add` smallint(6) NOT NULL DEFAULT '0',
  `wisdom_add` smallint(6) NOT NULL DEFAULT '0',
  `affairs_base` smallint(6) NOT NULL DEFAULT '0',
  `bravery_base` smallint(6) NOT NULL DEFAULT '0',
  `wisdom_base` smallint(6) NOT NULL DEFAULT '0',
  `loyalty` smallint(6) NOT NULL DEFAULT '50',
  `gold_need` double NOT NULL DEFAULT '0',
  `herotype` smallint(6) NOT NULL DEFAULT '10' COMMENT '将领类型',
  `command_base` smallint(6) NOT NULL DEFAULT '0',
  `command_add_on` smallint(6) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `cid` (`cid`)
) ENGINE=MyISAM AUTO_INCREMENT=30015 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_hero_card_schedule` (
  `hid` int(10) NOT NULL DEFAULT '0',
  `name` char(30) NOT NULL,
  `part` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_hero_expr_goods` (
  `gid` int(11) NOT NULL,
  `type` int(11) NOT NULL COMMENT '奖励类型1:普通道具，2:特殊道具，3:装备道具,4:基础属性,5:宝珠转换,6:强化装备,7:好感度',
  `name` varchar(250) NOT NULL DEFAULT '',
  `value` int(11) NOT NULL,
  UNIQUE KEY `type_gid` (`type`,`gid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_hero_expr_reward` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` int(11) NOT NULL COMMENT '历练类型',
  `sort` int(11) NOT NULL COMMENT '奖励类型1:普通道具，2:特殊道具，3:装备道具,4:基础属性,5:宝珠转换,6:强化装备,7:好感度',
  `details` varchar(256) NOT NULL COMMENT '奖励明细公式',
  `rate` int(11) NOT NULL COMMENT '触发概率',
  `inform` smallint(6) NOT NULL COMMENT '是否发通知',
  `name` varchar(512) NOT NULL DEFAULT '0' COMMENT '奖励内容',
  `minnum` int(11) NOT NULL COMMENT '元宝数值下限',
  `maxnum` int(11) NOT NULL COMMENT '元宝数值下限',
  `total` int(11) NOT NULL DEFAULT '0' COMMENT '每天每个玩家最多获取的次数,0表示不限制',
  `win` int(11) NOT NULL DEFAULT '0' COMMENT '在将领切磋中，玩家是否胜利',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=3040 DEFAULT CHARSET=utf8 COMMENT='将领历练奖励内容';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_hero_expr_types` (
  `type` int(11) NOT NULL,
  `name` varchar(64) NOT NULL COMMENT '历练名称',
  `intro` varchar(512) NOT NULL COMMENT '历练类型介绍',
  `descs` varchar(512) NOT NULL COMMENT '可选通用语,用","隔开',
  `min_hour` smallint(6) NOT NULL DEFAULT '0' COMMENT '最少历练小时数',
  `max_hour` smallint(6) NOT NULL DEFAULT '0' COMMENT '最多历练小时数',
  `min_carraymoney` smallint(6) NOT NULL DEFAULT '0' COMMENT '最少携带元宝数',
  `max_carraymoney` smallint(6) NOT NULL DEFAULT '0' COMMENT '最多携带元宝数',
  `hour_gold` int(11) NOT NULL COMMENT '每小时消耗黄金数',
  `hour_expr` int(11) NOT NULL COMMENT '每小时获得经验值',
  `hour_money` int(11) NOT NULL COMMENT '每小时消耗元宝数',
  `rate` varchar(256) NOT NULL COMMENT '奇遇触发概率公式'
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='将领历练可选类型';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_hero_level` (
  `level` int(11) NOT NULL AUTO_INCREMENT,
  `upgrade_exp` double NOT NULL,
  `total_exp` double NOT NULL,
  PRIMARY KEY (`level`)
) ENGINE=MyISAM AUTO_INCREMENT=126 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_hero_skill` (
  `id` int(11) NOT NULL,
  `name` char(10) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_login_reward_goal` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rewardtype` tinyint(4) NOT NULL DEFAULT '0' COMMENT '每日奖励类型',
  `name` char(255) NOT NULL,
  `sort` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:其它\r\n1:资源\r\n2:宝物\r\n3:军队\r\n4:城防\r\n5:任务物品\r\n6:建造建筑\r\n7:升级科技',
  `type` smallint(6) NOT NULL DEFAULT '0',
  `count` int(11) NOT NULL DEFAULT '0',
  `reduce` tinyint(4) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=16 DEFAULT CHARSET=utf8 COMMENT='用户登陆奖励条件\n';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_luoyang_city` (
  `cid` int(11) NOT NULL,
  `targetcid` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_luoyang_city_add` (
  `cid` int(11) NOT NULL,
  `image` int(11) NOT NULL,
  `name` char(20) NOT NULL,
  KEY `cid` (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_luoyang_troop` (
  `cid` int(11) NOT NULL,
  `hid` int(11) NOT NULL,
  `npcValue` int(11) NOT NULL,
  `sids` char(50) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_mail_limit` (
  `id` int(11) NOT NULL,
  `type` int(11) NOT NULL DEFAULT '0',
  `count` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_marry_mother_hero` (
  `hid` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(16) NOT NULL DEFAULT '' COMMENT '名字',
  `npcid` int(11) NOT NULL DEFAULT '0' COMMENT '斗将引用的将领hid',
  `face` smallint(6) NOT NULL,
  `command` smallint(6) NOT NULL DEFAULT '0' COMMENT '领将的统率',
  `affairs` smallint(6) NOT NULL DEFAULT '0' COMMENT '内政',
  `bravery` smallint(6) NOT NULL DEFAULT '0' COMMENT '勇武',
  `wisdom` smallint(6) NOT NULL DEFAULT '0' COMMENT '智谋',
  `rate` int(11) NOT NULL DEFAULT '0' COMMENT '触发概率',
  `introduce` char(255) NOT NULL DEFAULT '',
  `sex` smallint(6) NOT NULL DEFAULT '0',
  `count` int(11) NOT NULL DEFAULT '0' COMMENT '送玫瑰的数量',
  PRIMARY KEY (`hid`)
) ENGINE=MyISAM AUTO_INCREMENT=51 DEFAULT CHARSET=utf8 COMMENT='母亲数据表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_name` (
  `name` char(30) CHARACTER SET ascii NOT NULL,
  `value` char(255) NOT NULL,
  PRIMARY KEY (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_nobility` (
  `id` int(11) NOT NULL,
  `name` char(20) NOT NULL,
  `city_count` smallint(6) NOT NULL DEFAULT '0' COMMENT '城池数量',
  `salary` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_npc_hero` (
  `npcid` int(11) NOT NULL,
  `uid` int(11) NOT NULL DEFAULT '0',
  `name` char(30) NOT NULL,
  `zi` char(30) NOT NULL DEFAULT '',
  `sex` tinyint(4) NOT NULL DEFAULT '0',
  `face` smallint(6) NOT NULL DEFAULT '0',
  `affairs_base` smallint(6) NOT NULL DEFAULT '0',
  `bravery_base` smallint(6) NOT NULL,
  `wisdom_base` smallint(6) NOT NULL,
  `province` tinyint(4) NOT NULL,
  `introduce` text NOT NULL,
  `type` tinyint(4) NOT NULL DEFAULT '0',
  PRIMARY KEY (`npcid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_npc_hero_copy` (
  `id` int(11) NOT NULL,
  `npcid` int(11) NOT NULL DEFAULT '0',
  `heroid` int(11) NOT NULL DEFAULT '0',
  `count` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_npc_task` (
  `npcid` int(11) NOT NULL,
  `taskid` int(11) NOT NULL,
  PRIMARY KEY (`npcid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_office_pos` (
  `id` tinyint(4) NOT NULL,
  `name` char(30) NOT NULL,
  `salary` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_out_drop` (
  `gid` int(11) NOT NULL,
  `rate` int(11) NOT NULL DEFAULT '0' COMMENT '品物掉落的概率',
  PRIMARY KEY (`gid`),
  UNIQUE KEY `idx_gid` (`gid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_out_droprate` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `province` int(11) NOT NULL DEFAULT '0',
  `type` int(11) NOT NULL DEFAULT '0',
  `rate` int(11) NOT NULL DEFAULT '1' COMMENT '落掉物品的概率',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=26 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_out_npcrate` (
  `province` int(11) NOT NULL DEFAULT '0',
  `rate` float NOT NULL DEFAULT '0',
  PRIMARY KEY (`province`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_pack_goods` (
  `gid` int(11) NOT NULL COMMENT '道具包ID',
  `goods` char(255) NOT NULL COMMENT '商品编码\r\nN,gid,count,gid,count......\r\nN表示有多个个商品，gid指定道具ID（0指定元宝），count指定该道具个数',
  `armor` varchar(512) DEFAULT NULL,
  `res` varchar(512) DEFAULT NULL,
  `things` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`gid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_page_time` (
  `time` int(11) NOT NULL,
  `type` tinyint(4) NOT NULL DEFAULT '0' COMMENT '要发放的天书类型，０表示概率最小的，１表示封皮',
  `used` tinyint(4) NOT NULL DEFAULT '0' COMMENT '表示这个时间点的事件是否已经触发，０表示未触发，１表示触发',
  PRIMARY KEY (`time`)
) ENGINE=MEMORY DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_pass` (
  `name` varchar(255) NOT NULL,
  `value` text,
  PRIMARY KEY (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_pk_battle` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '战役编号',
  `battlename` varchar(64) NOT NULL COMMENT '战役名称',
  `hero_level` int(11) NOT NULL DEFAULT '1' COMMENT '君主将等级',
  `user_level` int(11) NOT NULL DEFAULT '0' COMMENT '修为等级',
  `description` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=11 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_pk_first` (
  `battleid` int(11) NOT NULL DEFAULT '0',
  `rankid` int(11) NOT NULL DEFAULT '0',
  `type` int(11) NOT NULL DEFAULT '0',
  `reward` varchar(256) NOT NULL COMMENT '类型，物品id，数量；0,11,1;1,11,2。0,goods;1,armor',
  `uid` int(11) NOT NULL DEFAULT '1',
  `passtime` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL DEFAULT '0',
  UNIQUE KEY `idx_battleid_levelid` (`battleid`,`type`,`rankid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_pk_hero` (
  `hid` int(11) NOT NULL DEFAULT '1',
  `battleid` int(11) NOT NULL DEFAULT '1',
  `name` varchar(64) NOT NULL COMMENT '将领名称',
  `flag` int(11) NOT NULL DEFAULT '0' COMMENT '0,非显示将;1,显示将',
  `sex` int(11) NOT NULL DEFAULT '1',
  `face` int(11) NOT NULL DEFAULT '1',
  `energy` int(11) NOT NULL DEFAULT '1',
  `command_base` int(11) NOT NULL DEFAULT '1',
  `affair_base` int(11) NOT NULL DEFAULT '1',
  `bravery_base` int(11) NOT NULL DEFAULT '1',
  `wisdom_base` int(11) NOT NULL DEFAULT '1',
  `speed_base` int(11) NOT NULL DEFAULT '1',
  `energy_add` int(11) NOT NULL DEFAULT '1',
  `command_add` int(11) NOT NULL DEFAULT '1',
  `affair_add` int(11) NOT NULL DEFAULT '1',
  `bravery_add` int(11) NOT NULL DEFAULT '1',
  `wisdom_add` int(11) NOT NULL DEFAULT '1',
  `speed_add` int(11) NOT NULL DEFAULT '1',
  PRIMARY KEY (`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_pk_level` (
  `battleid` int(11) NOT NULL DEFAULT '1' COMMENT '战役编号',
  `levelid` int(11) NOT NULL DEFAULT '1' COMMENT '关卡编号',
  `type` int(11) NOT NULL DEFAULT '0' COMMENT '0,普通；1,精英',
  `levelname` varchar(64) NOT NULL COMMENT '关卡名称',
  `hid` int(11) NOT NULL DEFAULT '1',
  `area` int(11) NOT NULL DEFAULT '1',
  UNIQUE KEY `idx_battleid_levelid` (`battleid`,`levelid`,`type`,`hid`,`area`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_pk_reward` (
  `battleid` int(11) NOT NULL DEFAULT '0',
  `type` int(11) NOT NULL DEFAULT '0' COMMENT '0,普通;1,精英',
  `rewardtype` int(11) NOT NULL DEFAULT '0' COMMENT '0,good;1,armor',
  `rewardid` int(11) NOT NULL DEFAULT '0' COMMENT '对应的物品id',
  `count` int(11) NOT NULL DEFAULT '1',
  UNIQUE KEY `idx_battleid_levelid` (`battleid`,`type`,`rewardtype`,`rewardid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_province` (
  `id` int(11) NOT NULL,
  `name` char(20) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_recipe` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `gid` int(11) NOT NULL,
  `recipe` varchar(255) CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL COMMENT '格式: gid,count,gid,count,gid,count',
  PRIMARY KEY (`id`),
  UNIQUE KEY `gid` (`gid`)
) ENGINE=MyISAM AUTO_INCREMENT=122 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_recruit_hero` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `actid` varchar(255) DEFAULT '1' COMMENT '对应cfg_act中的actid',
  `heroname` char(15) NOT NULL,
  `herotype` smallint(6) NOT NULL DEFAULT '0' COMMENT '将领类型',
  `min_face` smallint(6) NOT NULL,
  `max_face` smallint(6) NOT NULL,
  `min_affairs_base` smallint(6) NOT NULL DEFAULT '0',
  `max_affairs_base` smallint(6) NOT NULL DEFAULT '0',
  `min_bravery_base` smallint(6) NOT NULL DEFAULT '0',
  `max_bravery_base` smallint(6) NOT NULL DEFAULT '0',
  `min_wisdom_base` smallint(6) NOT NULL DEFAULT '0',
  `max_wisdom_base` smallint(6) NOT NULL DEFAULT '0',
  `min_loyalty` smallint(6) NOT NULL,
  `max_loyalty` smallint(6) NOT NULL,
  `rate` int(11) DEFAULT '0' COMMENT '概率',
  `sex` tinyint(3) DEFAULT '0',
  `userhavecnt` tinyint(3) DEFAULT '1' COMMENT '单个玩家拥有同名活动将领的数量上限',
  `gentype` tinyint(3) DEFAULT NULL,
  `genid` int(11) DEFAULT NULL,
  `level` int(11) DEFAULT '0',
  `min_level` int(11) DEFAULT '0',
  `max_level` int(11) DEFAULT '0',
  `min_command_base` smallint(6) NOT NULL DEFAULT '0',
  `max_command_base` smallint(6) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=184 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_res_name` (
  `resid` int(11) NOT NULL,
  `resname` char(10) NOT NULL DEFAULT '',
  PRIMARY KEY (`resid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_rumor_hero` (
  `npcid` int(11) NOT NULL,
  `price` smallint(6) NOT NULL DEFAULT '0',
  PRIMARY KEY (`npcid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_rumor_thing` (
  `tid` int(11) NOT NULL,
  `type` tinyint(4) NOT NULL COMMENT '消息类型\r\n0：一般物品，没有详细介绍\r\n1：全服只有一个在刷的物品，和将领一样\r\n2：特定物品，有介绍和详细描述',
  `price` smallint(6) NOT NULL DEFAULT '0',
  `introduce` char(255) NOT NULL,
  `detail` char(255) NOT NULL,
  PRIMARY KEY (`tid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_rumor_troop` (
  `id` int(11) NOT NULL,
  `tid` int(11) NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL DEFAULT '',
  `type` int(11) NOT NULL DEFAULT '0',
  `price` int(11) NOT NULL DEFAULT '0',
  `introduce` text,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_sc_goods` (
  `id` int(11) NOT NULL,
  `goodsid` int(11) NOT NULL DEFAULT '0',
  `price` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_shop` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(30) NOT NULL COMMENT '品商名称',
  `gid` int(11) NOT NULL,
  `pack` int(11) NOT NULL DEFAULT '1' COMMENT '商品包含多少个道具',
  `price` smallint(11) NOT NULL DEFAULT '10' COMMENT '商品价格',
  `oriprice` smallint(6) NOT NULL DEFAULT '10' COMMENT '商品原价',
  `onsale` tinyint(11) NOT NULL DEFAULT '1' COMMENT '是否上架',
  `totalCount` int(11) NOT NULL DEFAULT '2000000000' COMMENT '该商品总量，买完为止\r\n2000000000：表示不限\r\nN表示限制N个',
  `userbuycnt` int(11) NOT NULL DEFAULT '0',
  `daybuycnt` tinyint(4) NOT NULL DEFAULT '0' COMMENT '每天购买次数\r\n0：不限制\r\nN：每天只能买N个',
  `position` int(11) NOT NULL DEFAULT '0' COMMENT '商城里道具出现的位置，按group分类后从小到大显示',
  `group` tinyint(4) NOT NULL DEFAULT '0',
  `rebate` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否是特价商品\r\n0：非特价\r\nN：推到特价N号位置',
  `commend` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否属于推荐商品\r\n0：不推荐\r\nN：推荐到N号位置',
  `hot` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否属于热卖商品\r\n0：非热卖\r\nN：推到热卖N号位置',
  `starttime` int(11) NOT NULL DEFAULT '0' COMMENT '商品上柜时间',
  `endtime` int(11) NOT NULL DEFAULT '2000000000' COMMENT '商品撤下时间\r\n2000000000：表示永久卖\r\n其他表示具体时间',
  `image` int(11) NOT NULL DEFAULT '0' COMMENT '指定商品图片\r\n0表示用道具图片\r\nN表示指定N号商品图片',
  `description` char(255) NOT NULL DEFAULT '' COMMENT '商品说明',
  `battleshop` tinyint(4) NOT NULL DEFAULT '0',
  `creditPrice` int(11) NOT NULL DEFAULT '0',
  `medalPrice` int(11) NOT NULL DEFAULT '0',
  `medalTypeId` int(11) NOT NULL DEFAULT '30000',
  `battleGoodsType` int(11) NOT NULL DEFAULT '0',
  `battledaybuycnt` int(11) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `gid` (`gid`),
  KEY `onsale` (`onsale`)
) ENGINE=MyISAM AUTO_INCREMENT=50301 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_shop_add` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(30) NOT NULL COMMENT '品商名称',
  `gid` int(11) NOT NULL,
  `pack` int(11) NOT NULL DEFAULT '1' COMMENT '商品包含多少个道具',
  `price` smallint(11) NOT NULL DEFAULT '10' COMMENT '商品价格',
  `oriprice` smallint(6) NOT NULL DEFAULT '10' COMMENT '商品原价',
  `onsale` tinyint(11) NOT NULL DEFAULT '1' COMMENT '是否上架',
  `totalCount` int(11) NOT NULL DEFAULT '2000000000' COMMENT '该商品总量，买完为止\r\n2000000000：表示不限\r\nN表示限制N个',
  `userbuycnt` int(11) NOT NULL DEFAULT '0',
  `daybuycnt` tinyint(4) NOT NULL DEFAULT '0' COMMENT '每天购买次数\r\n0：不限制\r\nN：每天只能买N个',
  `position` int(11) NOT NULL DEFAULT '0' COMMENT '商城里道具出现的位置，按group分类后从小到大显示',
  `group` tinyint(4) NOT NULL DEFAULT '0',
  `rebate` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否是特价商品\r\n0：非特价\r\nN：推到特价N号位置',
  `commend` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否属于推荐商品\r\n0：不推荐\r\nN：推荐到N号位置',
  `hot` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否属于热卖商品\r\n0：非热卖\r\nN：推到热卖N号位置',
  `starttime` int(11) NOT NULL DEFAULT '0' COMMENT '商品上柜时间',
  `endtime` int(11) NOT NULL DEFAULT '2000000000' COMMENT '商品撤下时间\r\n2000000000：表示永久卖\r\n其他表示具体时间',
  `image` int(11) NOT NULL DEFAULT '0' COMMENT '指定商品图片\r\n0表示用道具图片\r\nN表示指定N号商品图片',
  `description` char(255) NOT NULL DEFAULT '' COMMENT '商品说明',
  `battleshop` tinyint(4) NOT NULL DEFAULT '0',
  `creditPrice` int(11) NOT NULL DEFAULT '0',
  `medalPrice` int(11) NOT NULL DEFAULT '0',
  `medalTypeId` int(11) NOT NULL DEFAULT '30000',
  `battleGoodsType` int(11) NOT NULL DEFAULT '0',
  `battledaybuycnt` int(11) DEFAULT '0',
  `shoptype` int(11) NOT NULL DEFAULT '1' COMMENT '商城类型：1礼金2五珠钱3铜币',
  PRIMARY KEY (`id`),
  KEY `gid` (`gid`),
  KEY `onsale` (`onsale`)
) ENGINE=MyISAM AUTO_INCREMENT=41022 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_shop_arm` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(30) NOT NULL COMMENT '商品名称',
  `aid` int(11) NOT NULL COMMENT '商品对应的装备',
  `pack` int(11) NOT NULL DEFAULT '1' COMMENT '商品包含多少个装备',
  `price` smallint(11) NOT NULL DEFAULT '10' COMMENT '商品价格',
  `oriprice` smallint(6) NOT NULL DEFAULT '10' COMMENT '商品原价',
  `onsale` tinyint(11) NOT NULL DEFAULT '1' COMMENT '是否上架',
  `totalCount` int(11) NOT NULL DEFAULT '2000000000' COMMENT '该商品总量，买完为止\r\n2000000000：表示不限\r\nN表示限制N个',
  `userbuycnt` tinyint(4) NOT NULL DEFAULT '0' COMMENT '每人购买次数\r\n0：表示不限购买次数\r\nN：表示每人最多购买N次',
  `daybuycnt` tinyint(4) NOT NULL DEFAULT '0' COMMENT '每天购买次数\r\n0：不限制\r\nN：每天只能买N个',
  `position` int(11) NOT NULL DEFAULT '0' COMMENT '商城里道具出现的位置，按group分类后从小到大显示',
  `group` tinyint(4) NOT NULL DEFAULT '0' COMMENT '商品类型\r\n0:宝物类\r\n1:加速类\r\n2:生产类\r\n3:宝箱类\r\n4:珠宝类\r\n5:任务类',
  `rebate` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否是特价商品\r\n0：非特价\r\nN：推到特价N号位置',
  `commend` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否属于推荐商品\r\n0：不推荐\r\nN：推荐到N号位置',
  `hot` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否属于热卖商品\r\n0：非热卖\r\nN：推到热卖N号位置',
  `starttime` int(11) NOT NULL DEFAULT '0' COMMENT '商品上柜时间',
  `endtime` int(11) NOT NULL DEFAULT '2000000000' COMMENT '商品撤下时间\r\n2000000000：表示永久卖\r\n其他表示具体时间',
  `image` int(11) NOT NULL DEFAULT '0' COMMENT '指定商品图片\r\n0表示用道具图片\r\nN表示指定N号商品图片',
  `description` char(255) NOT NULL DEFAULT '' COMMENT '商品说明',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=90 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_shop_day_clean` (
  `sid` int(11) NOT NULL,
  PRIMARY KEY (`sid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_skill_rate` (
  `skill_id` tinyint(4) NOT NULL,
  `rate` tinyint(4) NOT NULL,
  PRIMARY KEY (`skill_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_soldier` (
  `sid` int(11) NOT NULL AUTO_INCREMENT,
  `type` tinyint(4) NOT NULL DEFAULT '1' COMMENT '兵种类型\r\n1：民夫\r\n2：义兵\r\n3：斥侯\r\n4：长枪兵\r\n5：刀盾兵\r\n6：弓箭兵\r\n7：轻骑兵\r\n8：铁骑兵\r\n9：辎重兵\r\n10：床弩\r\n11：冲车\r\n12：投石车',
  `fromcity` tinyint(4) NOT NULL COMMENT '是否为城内可招兵种',
  `name` char(100) NOT NULL,
  `description` char(255) NOT NULL,
  `hp` int(11) NOT NULL DEFAULT '0' COMMENT '生命',
  `ap` int(11) NOT NULL DEFAULT '0' COMMENT '攻击',
  `dp` int(11) NOT NULL DEFAULT '0' COMMENT '防御',
  `range` int(11) NOT NULL DEFAULT '0',
  `speed` int(11) NOT NULL DEFAULT '0',
  `carry` int(11) NOT NULL DEFAULT '0',
  `time_need` int(11) NOT NULL DEFAULT '0',
  `wood_need` double NOT NULL DEFAULT '0',
  `rock_need` double NOT NULL DEFAULT '0',
  `iron_need` double NOT NULL DEFAULT '0',
  `food_need` double NOT NULL DEFAULT '0',
  `gold_need` double NOT NULL DEFAULT '0',
  `people_need` tinyint(4) NOT NULL DEFAULT '1',
  `food_use` double NOT NULL DEFAULT '0',
  PRIMARY KEY (`sid`),
  KEY `fromcity` (`fromcity`)
) ENGINE=MyISAM AUTO_INCREMENT=96 DEFAULT CHARSET=utf8 COMMENT='建筑的设定';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_soldier_condition` (
  `sid` int(11) NOT NULL,
  `pre_type` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:building; 1:technic',
  `pre_id` int(11) NOT NULL DEFAULT '0',
  `pre_level` int(11) NOT NULL DEFAULT '0',
  KEY `bid_level` (`sid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='建造建筑的前提条件';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_soldier_convert` (
  `id` int(11) NOT NULL,
  `soldierid` int(11) NOT NULL DEFAULT '0',
  `convertsoldierid` int(11) NOT NULL DEFAULT '0',
  `rate` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_soldier_rate` (
  `id` int(11) NOT NULL,
  `soldierid` int(11) NOT NULL DEFAULT '0',
  `rate` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_soldier_special_city` (
  `cid` int(11) NOT NULL,
  `sid` int(4) NOT NULL COMMENT '可造兵的兵种id',
  `province` int(4) NOT NULL DEFAULT '1' COMMENT '所在州标记',
  `type` int(4) NOT NULL DEFAULT '0' COMMENT '1,州城;2,郡城;3,县城;0,活动城池',
  `provincename` varchar(20) NOT NULL DEFAULT '' COMMENT '所在州的名称',
  `rsid` char(1) NOT NULL DEFAULT '0' COMMENT '0,表示定了，1表示随机。是不是兵种为随机',
  PRIMARY KEY (`cid`),
  KEY `cid_sid` (`cid`,`sid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_special_act` (
  `cid` int(11) NOT NULL DEFAULT '0' COMMENT '设置为不大于1000的数',
  `gid` int(11) NOT NULL DEFAULT '0' COMMENT '落掉物品的gid',
  `count` int(11) NOT NULL DEFAULT '0' COMMENT '天每掉落的次数',
  `starttime` varchar(32) NOT NULL DEFAULT '0' COMMENT '动活开启时间',
  `endtime` varchar(32) NOT NULL DEFAULT '0' COMMENT '动活结束时间'
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_strong_probability` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `level` int(11) NOT NULL,
  `suc_value` int(11) DEFAULT NULL COMMENT '成功概率',
  `strong_value` int(11) DEFAULT NULL COMMENT '强化的值',
  `zero_value` int(11) DEFAULT '0' COMMENT '失败后归0的概率',
  `degrade_value` int(11) DEFAULT '0' COMMENT '失败后降级的概率',
  `intact_value` int(11) DEFAULT '0' COMMENT '失败后无损失的概率',
  `xilian_rate` int(11) DEFAULT NULL COMMENT '洗练出极品属性的概率',
  PRIMARY KEY (`id`),
  UNIQUE KEY `level` (`level`),
  UNIQUE KEY `s_level` (`level`)
) ENGINE=MyISAM AUTO_INCREMENT=16 DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_systask_rate` (
  `tid` int(11) NOT NULL,
  `rate` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`tid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_task` (
  `id` int(11) NOT NULL,
  `group` int(11) NOT NULL DEFAULT '1' COMMENT '任务组',
  `pretid` int(11) NOT NULL DEFAULT '0',
  `name` char(50) NOT NULL,
  `content` text NOT NULL,
  `todo` text NOT NULL,
  `default` tinyint(4) NOT NULL DEFAULT '0' COMMENT '默认状态',
  `inform` tinyint(4) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_group` (`group`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_task_cid` (
  `bid` int(11) NOT NULL DEFAULT '0' COMMENT '战场id',
  `tid` int(11) NOT NULL COMMENT '任务id',
  `cid` int(11) NOT NULL COMMENT '任务相关联的城池id',
  `type` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:主线任务 1:支线任务',
  PRIMARY KEY (`tid`,`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_task_goal` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tid` int(11) NOT NULL COMMENT '任务',
  `content` char(255) NOT NULL,
  `sort` smallint(6) NOT NULL DEFAULT '0' COMMENT '0:其它\r\n1:资源\r\n2:宝物\r\n3:军队\r\n4:城防\r\n5:任务物品\r\n6:建造建筑\r\n7:升级科技',
  `type` int(11) NOT NULL DEFAULT '0',
  `count` int(11) NOT NULL DEFAULT '0',
  `reduce` tinyint(4) NOT NULL DEFAULT '0',
  `strong_level` int(11) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `sort` (`sort`),
  KEY `idx_tid` (`tid`)
) ENGINE=MyISAM AUTO_INCREMENT=4001168 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_task_goal_copy` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tid` int(11) NOT NULL COMMENT '任务',
  `content` char(255) NOT NULL,
  `sort` smallint(6) NOT NULL DEFAULT '0' COMMENT '0:其它\r\n1:资源\r\n2:宝物\r\n3:军队\r\n4:城防\r\n5:任务物品\r\n6:建造建筑\r\n7:升级科技',
  `type` int(11) NOT NULL DEFAULT '0',
  `count` int(11) NOT NULL DEFAULT '0',
  `reduce` tinyint(4) NOT NULL DEFAULT '0',
  `strong_level` int(11) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `sort` (`sort`),
  KEY `idx_tid` (`tid`)
) ENGINE=MyISAM AUTO_INCREMENT=4001168 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_task_group` (
  `id` int(11) NOT NULL,
  `name` char(255) NOT NULL,
  `description` text NOT NULL,
  `type` tinyint(4) NOT NULL DEFAULT '0' COMMENT '任务类型\r\n0：成长任务\r\n1：日常任务\r\n2：名将任务\r\n3：史诗任务',
  `priority` int(11) DEFAULT '10000',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_task_reward` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tid` int(11) NOT NULL,
  `sort` tinyint(4) NOT NULL DEFAULT '0' COMMENT '1:资源\r\n2:宝物\r\n3:军队\r\n4:城防\r\n5:任务物品',
  `type` int(11) NOT NULL DEFAULT '0' COMMENT '资源是:\r\n1黄金,\r\n2粮食,\r\n3木材,\r\n4石料,\r\n5铁锭,\r\n6人口,\r\n7民心,\r\n8民怨,\r\n9声望,',
  `count` int(11) DEFAULT NULL,
  `name` varchar(100) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `tid` (`tid`)
) ENGINE=MyISAM AUTO_INCREMENT=35329 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_task_schedule` (
  `taskid` int(11) NOT NULL,
  `next_reset` int(11) NOT NULL,
  `interval` int(11) NOT NULL DEFAULT '86400',
  PRIMARY KEY (`taskid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_technic` (
  `tid` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(100) NOT NULL,
  `description` char(100) NOT NULL DEFAULT '',
  PRIMARY KEY (`tid`)
) ENGINE=MyISAM AUTO_INCREMENT=29 DEFAULT CHARSET=utf8 COMMENT='科技设定表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_technic_condition` (
  `tid` int(11) NOT NULL,
  `level` int(11) NOT NULL,
  `pre_type` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:building; 1:technic',
  `pre_id` int(11) NOT NULL DEFAULT '0',
  `pre_level` int(11) NOT NULL DEFAULT '0',
  KEY `bid_level` (`tid`,`level`),
  KEY `idx_tid` (`tid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='建造建筑的前提条件';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_technic_level` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tid` int(11) NOT NULL,
  `level` int(11) NOT NULL,
  `upgrade_wood` double(11,0) NOT NULL DEFAULT '0',
  `upgrade_rock` double(11,0) NOT NULL DEFAULT '0',
  `upgrade_iron` double(11,0) NOT NULL DEFAULT '0',
  `upgrade_food` double(11,0) NOT NULL DEFAULT '0',
  `upgrade_gold` double(11,0) NOT NULL DEFAULT '0',
  `upgrade_people` int(11) NOT NULL,
  `upgrade_time` int(11) NOT NULL DEFAULT '0',
  `description` char(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bid_level` (`tid`,`level`),
  KEY `idx_tid` (`tid`)
) ENGINE=MyISAM AUTO_INCREMENT=282 DEFAULT CHARSET=utf8 COMMENT='建筑的级别设定';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_thing_task` (
  `thingid` int(11) NOT NULL,
  `taskid` int(11) NOT NULL,
  PRIMARY KEY (`thingid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_things` (
  `tid` int(11) NOT NULL,
  `name` char(255) NOT NULL,
  `inuse` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否开启使用',
  `position` int(11) NOT NULL DEFAULT '0',
  `image` int(11) NOT NULL DEFAULT '0' COMMENT '物品的图像，０表示用thing_tid，其他表示画像',
  `description` char(255) NOT NULL,
  `battleBelong` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`tid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_tie` (
  `tieid` int(11) NOT NULL COMMENT '套装id',
  `count` int(11) NOT NULL DEFAULT '0' COMMENT '套装件数',
  `name` varchar(255) NOT NULL COMMENT '套装名称',
  PRIMARY KEY (`tieid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_tie_attribute` (
  `attid` int(11) NOT NULL COMMENT '属性id',
  `tieid` int(11) NOT NULL COMMENT '套装id',
  `value` int(11) NOT NULL COMMENT '属性值',
  `precond` int(11) NOT NULL COMMENT '激活此属性需要的装备件数',
  UNIQUE KEY `idx_attid_tieid` (`attid`,`tieid`,`precond`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_tie_deify_attribute` (
  `attid` int(11) NOT NULL COMMENT '属性id',
  `tieid` int(11) NOT NULL COMMENT '套装id',
  `low` int(11) NOT NULL COMMENT '属性下限',
  `high` int(11) NOT NULL COMMENT '属性上限',
  UNIQUE KEY `idx_deify_attid` (`tieid`,`attid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_trick` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(30) NOT NULL,
  `usetype` tinyint(4) NOT NULL DEFAULT '0' COMMENT '使用方式\r\n0：对本城\r\n1：对敌城\r\n2：本人军队\r\n3：敌人军队',
  `cost` smallint(6) NOT NULL DEFAULT '0' COMMENT '锦囊使用数量',
  `description` char(255) NOT NULL,
  `manual` char(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=29 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_troop_tactics` (
  `stype` tinyint(4) NOT NULL AUTO_INCREMENT,
  `plunder_action` tinyint(4) NOT NULL,
  `plunder_target` tinyint(4) NOT NULL,
  `invade_action` tinyint(4) NOT NULL,
  `invade_target` tinyint(4) NOT NULL,
  `invade_action2` tinyint(4) NOT NULL,
  `invade_target2` tinyint(4) NOT NULL,
  `patrol_action` tinyint(4) NOT NULL,
  `field_action` tinyint(4) NOT NULL,
  `field_target` tinyint(4) NOT NULL,
  PRIMARY KEY (`stype`)
) ENGINE=MyISAM AUTO_INCREMENT=51 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_troop_task` (
  `tid` int(11) NOT NULL,
  `name` varchar(255) NOT NULL DEFAULT '',
  `type` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`tid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_union_building_upgrade` (
  `bid` int(11) NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL DEFAULT '0',
  `level` int(11) NOT NULL DEFAULT '0',
  `intro` varchar(255) NOT NULL DEFAULT '0',
  `curintro` varchar(255) NOT NULL DEFAULT '0',
  `nextintro` varchar(255) NOT NULL DEFAULT '0',
  `num` int(11) NOT NULL DEFAULT '0',
  `nextnum` int(11) NOT NULL DEFAULT '0',
  `open` int(11) NOT NULL DEFAULT '0'
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_union_reward` (
  `rank` int(11) NOT NULL DEFAULT '0',
  `pos` int(11) NOT NULL DEFAULT '0',
  `gid` int(11) NOT NULL DEFAULT '0',
  `count` int(11) NOT NULL DEFAULT '0'
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_union_store` (
  `gid` int(11) NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL DEFAULT '0',
  `level` int(11) NOT NULL DEFAULT '0',
  `intro` varchar(255) NOT NULL DEFAULT '0',
  `needInfo` varchar(255) NOT NULL DEFAULT '0'
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_update_history` (
  `id` int(6) NOT NULL AUTO_INCREMENT,
  `time` int(11) DEFAULT '0' COMMENT '新更时间',
  `title` varchar(50) DEFAULT ' ' COMMENT '更新提要',
  `detail` text COMMENT '更新具体内容',
  `version` varchar(30) DEFAULT ' ' COMMENT '版本号',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=11 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_user_action` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL COMMENT '用户点击操作名称',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=10003 DEFAULT CHARSET=utf8 COMMENT='用户点击操作类型';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_user_level` (
  `level` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`level`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_version` (
  `id` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_wall` (
  `level` tinyint(4) NOT NULL COMMENT '级别',
  `life` int(11) NOT NULL DEFAULT '0' COMMENT '耐久度',
  `range_add` int(11) NOT NULL DEFAULT '0' COMMENT '射程加成百分比',
  `area` int(11) NOT NULL DEFAULT '0' COMMENT '容量',
  `dp` int(11) NOT NULL,
  `dp_add` int(11) NOT NULL,
  PRIMARY KEY (`level`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_world_type` (
  `type` tinyint(4) NOT NULL,
  `name` char(10) NOT NULL,
  PRIMARY KEY (`type`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_xilian` (
  `id` int(11) NOT NULL,
  `property` varchar(255) DEFAULT NULL COMMENT '该兵种可洗练出的属性,0生命，1攻击，2防御，3射程，4速度，5负重',
  `name` varchar(255) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL COMMENT 'a,b  a：1defence，2soldier   b：did或sid',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cfg_xilian_type` (
  `type` int(11) NOT NULL,
  `minAdd` int(11) DEFAULT NULL,
  `maxAdd` int(11) DEFAULT NULL,
  PRIMARY KEY (`type`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `dongzhuo_progress` (
  `tid` int(11) NOT NULL,
  `group` int(11) NOT NULL COMMENT '任务组',
  `name` char(32) NOT NULL,
  `maxvalue` int(11) NOT NULL COMMENT '要需交多少次',
  `curvalue` int(11) NOT NULL DEFAULT '0' COMMENT '已经完成多少次',
  PRIMARY KEY (`tid`),
  KEY `idx_group` (`group`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fc_combat` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `open` tinyint(4) NOT NULL DEFAULT '1',
  `starttime` int(11) NOT NULL,
  `endtime` int(11) NOT NULL,
  `havefield` tinyint(4) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fc_fields` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `combatid` int(11) NOT NULL,
  `wid` int(11) NOT NULL,
  `uid` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `combatid` (`combatid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fc_log` (
  `time` int(11) NOT NULL,
  `combatid` int(11) NOT NULL,
  `wid` int(11) NOT NULL,
  `uid` int(11) NOT NULL,
  `cid` int(11) NOT NULL,
  KEY `combatid` (`combatid`,`wid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `gold_card_log` (
  `orderid` varchar(30) NOT NULL,
  `type` tinyint(4) NOT NULL,
  `payname` varchar(30) NOT NULL,
  `passport` varchar(30) NOT NULL,
  `passtype` varchar(30) NOT NULL,
  `itemcode` text NOT NULL,
  `code` varchar(30) NOT NULL,
  `time` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `goods_request` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  `reason` char(100) NOT NULL DEFAULT '',
  `adminid` int(11) NOT NULL,
  `state` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:请求中\r\n1:已经处理\r\n2:取消',
  `mesg_content` varchar(1000) NOT NULL DEFAULT '',
  `mesg_title` varchar(200) NOT NULL DEFAULT '',
  `gid` int(11) NOT NULL DEFAULT '0',
  `name` varchar(50) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `hd_dalibao` (
  `uid` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `huangjin_progress` (
  `tid` int(11) NOT NULL,
  `group` int(11) NOT NULL COMMENT '任务组',
  `name` char(32) NOT NULL,
  `maxvalue` int(11) NOT NULL COMMENT '要需交多少次',
  `curvalue` int(11) NOT NULL DEFAULT '0' COMMENT '已经完成多少次',
  PRIMARY KEY (`tid`),
  KEY `idx_group` (`group`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `huangjin_task_log` (
  `uid` int(11) NOT NULL COMMENT '用户ID',
  `jungong` int(11) NOT NULL DEFAULT '0' COMMENT '军功册数量',
  `juanxian` int(11) NOT NULL DEFAULT '0' COMMENT '捐献薄',
  `qinwang` int(11) NOT NULL DEFAULT '0' COMMENT '勤王诏',
  `gongpin` int(11) NOT NULL DEFAULT '0' COMMENT '贡品录',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `huangjin_task_log_union` (
  `unionid` int(11) NOT NULL COMMENT '用户ID',
  `jungong` int(11) NOT NULL DEFAULT '0' COMMENT '军功册数量',
  `juanxian` int(11) NOT NULL DEFAULT '0' COMMENT '捐献薄',
  `qinwang` int(11) NOT NULL DEFAULT '0' COMMENT '勤王诏',
  `gongpin` int(11) NOT NULL DEFAULT '0' COMMENT '贡品录',
  PRIMARY KEY (`unionid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ipcount` (
  `ip` int(11) DEFAULT NULL,
  `count` bigint(21) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_act` (
  `uid` int(11) NOT NULL,
  `actid` int(11) NOT NULL,
  `sort` int(11) NOT NULL,
  `type` int(11) NOT NULL,
  `count` int(11) NOT NULL DEFAULT '1',
  `log_type` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_act_hero_expr` (
  `uid` int(11) NOT NULL,
  `type` int(11) NOT NULL COMMENT '练历类型',
  `qid` int(11) NOT NULL COMMENT '奇遇ID',
  `time` int(11) NOT NULL,
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_action_count` (
  `uid` int(11) NOT NULL,
  `aid` int(11) NOT NULL COMMENT '用户累计点击操作id',
  `count` int(11) NOT NULL COMMENT '用户点击操作累计次数',
  UNIQUE KEY `uid_aid` (`uid`,`aid`),
  KEY `aid_count` (`aid`,`count`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='用户点击操作累计数据记录';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_action_time` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) DEFAULT '0',
  `name` varchar(32) DEFAULT '',
  `time` int(11) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_activity_rank` (
  `actid` int(11) NOT NULL COMMENT '活动ID，参考cfg_activity_rank',
  `rank` int(11) NOT NULL COMMENT '该次活动的排名',
  `uid` int(11) NOT NULL COMMENT '用户UID',
  `name` varchar(32) NOT NULL COMMENT '用户君主名',
  `sort3` varchar(64) NOT NULL,
  `sort4` varchar(64) NOT NULL,
  `sort5` varchar(64) NOT NULL,
  `reward` tinyint(4) NOT NULL COMMENT '是否已经领奖，0未领奖，1已经领奖',
  `time` int(11) NOT NULL COMMENT '领取时间',
  PRIMARY KEY (`actid`,`rank`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_activity_rank_day` (
  `actid` int(11) NOT NULL COMMENT '活动ID，参考cfg_activity_rank',
  `day` tinyint(4) NOT NULL COMMENT '活动第几日',
  `rank` int(11) NOT NULL COMMENT '该次活动的排名',
  `uid` int(11) NOT NULL COMMENT '用户UID',
  `name` varchar(32) NOT NULL COMMENT '用户君主名',
  `sort3` varchar(64) NOT NULL,
  `sort4` varchar(64) NOT NULL,
  `sort5` varchar(64) NOT NULL,
  `reward` tinyint(4) NOT NULL COMMENT '是否已经领奖，0未领奖，1已经领奖',
  `time` int(11) NOT NULL COMMENT '领取时间',
  PRIMARY KEY (`actid`,`day`,`rank`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_admin` (
  `uid` int(11) NOT NULL COMMENT '管理员ID',
  `target` int(11) NOT NULL DEFAULT '0' COMMENT '目标ID,可能是用户UID,也可能是其他ID，跟op相关',
  `op` int(11) NOT NULL COMMENT '操作, ０表示登录，１表示下线，２表示查看联盟聊天，３表示关闭联盟聊天，４表示添加屏蔽字，５表示取消屏蔽字，６表示对玩家禁言，７表示对玩家解禁，８管理员发言',
  `time` int(11) NOT NULL,
  `remark` text NOT NULL COMMENT '释注',
  `reason` text NOT NULL COMMENT '作操理由'
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_armor` (
  `uid` int(11) NOT NULL,
  `armorid` int(11) NOT NULL,
  `count` tinyint(4) NOT NULL,
  `time` int(11) NOT NULL,
  `type` int(11) NOT NULL,
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_armor_combine` (
  `sid` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `armorid` int(11) NOT NULL COMMENT '装备ID',
  `hp` smallint(6) NOT NULL DEFAULT '0' COMMENT '装备耐久度',
  `hp_max` smallint(6) NOT NULL DEFAULT '0' COMMENT '备装当前最大耐久度',
  `hid` int(11) NOT NULL DEFAULT '0' COMMENT '目前在使用该装备的将领，０表示装备无人使用',
  `strong_level` int(11) DEFAULT '0',
  `strong_value` int(11) DEFAULT '0',
  `embed_pearls` varchar(255) DEFAULT '',
  `embed_holes` varchar(255) DEFAULT '' COMMENT '0:打开, 1:需要一级打孔器, 2:需要2级打孔器 3:不开的',
  `deified` varchar(255) DEFAULT NULL,
  `active_special` tinyint(4) NOT NULL DEFAULT '0',
  `strong_times` tinyint(4) DEFAULT '0',
  `combine_level` int(11) NOT NULL DEFAULT '0',
  `usegoods` int(11) NOT NULL DEFAULT '0',
  `success` int(11) NOT NULL DEFAULT '0',
  `mainsid` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`sid`),
  KEY `idx_uid_aid` (`uid`,`armorid`),
  KEY `idx_hid` (`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_armor_strong` (
  `uid` int(11) NOT NULL,
  `sid` int(11) NOT NULL,
  `armorid` int(11) NOT NULL,
  `type` smallint(6) NOT NULL DEFAULT '0' COMMENT '0,装备，1，坐骑',
  `startlevel` tinyint(4) NOT NULL,
  `endlevel` tinyint(4) NOT NULL,
  `usegoods` varchar(255) NOT NULL DEFAULT '0' COMMENT 'gid',
  `success` tinyint(4) NOT NULL COMMENT '0,未成功，1成功',
  `time` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_armor_type` (
  `id` tinyint(4) NOT NULL,
  `name` varchar(30) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_assemble_reward` (
  `rank` int(11) NOT NULL DEFAULT '0',
  `uid` int(11) NOT NULL DEFAULT '0',
  `name` char(30) NOT NULL,
  `reward` int(11) NOT NULL DEFAULT '0' COMMENT '0：未领取，1已领取',
  `time` int(11) NOT NULL DEFAULT '0' COMMENT '领取奖励的时间',
  PRIMARY KEY (`rank`),
  KEY `idx_uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_battle_drop` (
  `uid` int(11) NOT NULL,
  `count` smallint(6) NOT NULL,
  `time` int(11) NOT NULL,
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_battle_honour` (
  `uid` int(11) NOT NULL,
  `battlefieldid` int(11) NOT NULL,
  `honour` int(11) NOT NULL DEFAULT '0',
  `starttime` int(11) NOT NULL,
  `battleid` int(11) NOT NULL,
  `finishtime` int(11) NOT NULL DEFAULT '0' COMMENT '完成时间',
  `result` smallint(6) NOT NULL DEFAULT '0' COMMENT '0 胜利 1 失败 2 中途退出',
  `quittime` int(11) NOT NULL,
  `metal` int(11) NOT NULL,
  `unionid` int(11) NOT NULL DEFAULT '0',
  `level` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`,`battlefieldid`,`quittime`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_battle_msg` (
  `battlefieldid` int(11) NOT NULL,
  `eid` int(11) NOT NULL,
  PRIMARY KEY (`battlefieldid`,`eid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_battle_troop_reset` (
  `battlefieldid` int(11) NOT NULL,
  `hid` int(11) NOT NULL,
  PRIMARY KEY (`battlefieldid`,`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_book` (
  `uid` int(11) NOT NULL,
  `bid` int(11) NOT NULL,
  `level` int(11) NOT NULL,
  `count` tinyint(4) NOT NULL,
  `time` int(11) NOT NULL,
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_book_strong` (
  `uid` int(11) NOT NULL,
  `bid` int(11) NOT NULL,
  `startlevel` tinyint(4) NOT NULL,
  `endlevel` tinyint(4) NOT NULL,
  `usegoods` varchar(255) NOT NULL DEFAULT '0' COMMENT 'gid',
  `success` tinyint(4) NOT NULL COMMENT '0,未成功，1成功',
  `time` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_chat_admin` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL COMMENT '管理员ID',
  `target` int(11) NOT NULL DEFAULT '0' COMMENT '目标ID,可能是用户UID,也可能是其他ID，跟op相关',
  `op` int(11) NOT NULL COMMENT '操作, ０表示登录，１表示下线，２表示查看联盟聊天，３表示关闭联盟聊天，４表示添加屏蔽字，５表示取消屏蔽字，６表示对玩家禁言，７表示对玩家解禁，８管理员发言',
  `time` int(11) NOT NULL,
  `remark` text NOT NULL COMMENT '释注',
  `reason` text NOT NULL COMMENT '作操理由',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_child_culture` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `hid` int(11) NOT NULL COMMENT '孩子hid',
  `attid` int(11) NOT NULL DEFAULT '0' COMMENT '1：统帅，2：内政，3：勇武，4：智谋',
  `value` int(11) NOT NULL DEFAULT '0' COMMENT '加的点数',
  `time` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='孩子培养记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_child_status` (
  `hid` int(11) NOT NULL COMMENT '孩子hid',
  `uid` int(11) NOT NULL,
  `out_hid` int(11) NOT NULL DEFAULT '0' COMMENT '如果该孩子已经转化成将领 则表示将领hid，否则为0',
  `state` int(11) NOT NULL DEFAULT '0' COMMENT '0：保存母子培养关系，1：孩子周游列国去了，2：孩子被解雇了，3：逃亡状态，4：保存母子将领状态',
  `time` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='孩子状态改变记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_city_soldier` (
  `cid` int(11) NOT NULL COMMENT '城市ID,也就是城市的位置',
  `sid` int(11) NOT NULL DEFAULT '0' COMMENT '建筑ID,默认为0,代表无建筑',
  `count` int(11) NOT NULL DEFAULT '0' COMMENT '士兵数量',
  `uid` int(11) NOT NULL DEFAULT '0' COMMENT '用户编号',
  `type` int(11) NOT NULL DEFAULT '0' COMMENT '获得加兵的类型',
  UNIQUE KEY `cid_xy` (`cid`,`sid`,`type`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='玩家拥有的所有建筑\r\n';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_daily_action_count` (
  `aid` int(11) NOT NULL,
  `date` int(11) NOT NULL COMMENT '时间部分都设为0 用unix_timestamp(curdate())',
  `count` int(11) NOT NULL,
  UNIQUE KEY `aid_date` (`aid`,`date`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_day_money` (
  `day` int(11) NOT NULL,
  `money` int(11) NOT NULL,
  PRIMARY KEY (`day`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_everyday_task` (
  `uid` int(11) NOT NULL,
  `tid` int(11) NOT NULL,
  `gettime` int(11) NOT NULL,
  PRIMARY KEY (`uid`,`tid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_gather_count` (
  `uid` int(11) NOT NULL,
  `gid` int(11) NOT NULL,
  `count` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL DEFAULT '0',
  `id` int(11) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `u_g_id` (`uid`,`gid`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_gift` (
  `uid` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  `time` int(11) NOT NULL DEFAULT '0',
  `type` int(11) NOT NULL COMMENT '0：直充\r\n1：官网兑换\r\n2：新手礼包\r\n3：礼券\r\n4: GM操作\r\n10：购买道具\r\n20：宝箱开出\r\n50：市场向商人买\r\n51: 市场卖给商人\r\n60: 任务奖励\r\n70：墨家立即完成\r\n75：休假消耗元宝\r\n80: 招徕人口消耗',
  `gid` int(11) NOT NULL DEFAULT '0',
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_goods` (
  `uid` int(11) NOT NULL,
  `gid` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  `type` int(11) NOT NULL COMMENT '0:玩家使用\r\n1:野地刷出\r\n2:商场购买\r\n3:宝箱刷出\r\n4:任务奖励\r\n5:GM操作\r\n6:礼包赠送\r\n7:赏赐\r\n8:礼券兑换',
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_goods_monthly` (
  `uid` int(11) DEFAULT NULL,
  `gid` int(11) DEFAULT NULL,
  `count` int(11) DEFAULT NULL,
  `month` int(11) DEFAULT NULL COMMENT '月份,200902',
  `type` int(11) DEFAULT NULL COMMENT '0:玩家使用\\r\\n1:野地刷出\\r\\n2:商场购买\\r\\n3:宝箱刷出\\r\\n4:任务奖励\\r\\n5:GM操作\\r\\n6:礼包赠送\\r\\n7:赏赐\\r\\n8:礼券兑换'
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='根据uid,gid进行每月统计';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_goods_type` (
  `id` tinyint(4) NOT NULL,
  `name` varchar(30) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_hero_expr_reward` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL COMMENT '玩家编号',
  `cid` int(11) NOT NULL COMMENT '将领历练出发城池',
  `hid` int(11) NOT NULL COMMENT '将领编号',
  `type` int(11) NOT NULL COMMENT '公共奇遇订单类型',
  `sort` int(11) NOT NULL COMMENT '奖励类型1:普通道具，2:特殊道具，3:装备道具,4:基础属性,5:宝珠转换,6:强化装备,7:好感度',
  `money` int(11) NOT NULL COMMENT '需要花费的元宝数',
  `details` varchar(64) NOT NULL COMMENT '各种道具',
  `endtime` int(11) NOT NULL COMMENT '将领历练得到奖励的时间',
  `time` int(11) NOT NULL COMMENT '接受订单时间',
  PRIMARY KEY (`id`),
  KEY `uid_hid` (`uid`,`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_illegal_user` (
  `uid` int(11) NOT NULL,
  `name` char(32) NOT NULL,
  `count` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_lionize` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `npcid` int(11) NOT NULL,
  `type` int(11) NOT NULL DEFAULT '0' COMMENT '0，专属任务；1，任命；2，招降；3，公共任务',
  `count` int(11) NOT NULL DEFAULT '0',
  `time` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=13 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_lionize_type` (
  `id` int(11) NOT NULL,
  `name` varchar(30) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_login` (
  `uid` int(11) NOT NULL,
  `ip` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  `sip` char(20) DEFAULT NULL,
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_luoyang_belong` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL DEFAULT '0',
  `unionid` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL DEFAULT '0' COMMENT '分配洛阳的时间',
  `count` int(11) NOT NULL DEFAULT '0' COMMENT '连续拥有洛阳的次数',
  PRIMARY KEY (`id`),
  KEY `idx_time` (`time`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_merchant` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) DEFAULT '0' COMMENT '户用id',
  `time` int(11) DEFAULT '0' COMMENT '作操时间',
  `wood` int(11) DEFAULT '0' COMMENT '购买的数量',
  `food` int(11) DEFAULT '0' COMMENT '购买的数量',
  `iron` int(11) DEFAULT '0' COMMENT '购买的数量',
  `rock` int(11) DEFAULT '0' COMMENT '购买的数量',
  `gold` int(11) DEFAULT '0' COMMENT '购买的数量',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uid_time` (`uid`,`time`)
) ENGINE=MyISAM AUTO_INCREMENT=33 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_merge_city` (
  `uid` int(11) NOT NULL DEFAULT '0',
  `cid` int(11) NOT NULL DEFAULT '0',
  `time` int(11) DEFAULT '0',
  KEY `uid_cid` (`uid`,`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_money` (
  `uid` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  `time` int(11) NOT NULL DEFAULT '0',
  `type` int(11) NOT NULL COMMENT '0：直充\r\n1：官网兑换\r\n2：新手礼包\r\n3：礼券\r\n4: GM操作\r\n10：购买道具\r\n20：宝箱开出\r\n50：市场向商人买\r\n51: 市场卖给商人\r\n60: 任务奖励\r\n70：墨家立即完成\r\n75：休假消耗元宝\r\n80: 招徕人口消耗',
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_money_type` (
  `id` tinyint(4) NOT NULL,
  `name` varchar(30) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_month_money` (
  `uid` int(11) NOT NULL DEFAULT '0',
  `count` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL,
  UNIQUE KEY `idx_uid_time` (`uid`,`time`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_move_city` (
  `time` int(11) NOT NULL,
  `uid` int(11) NOT NULL,
  `fromcid` int(11) NOT NULL,
  `tocid` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_out_drop` (
  `uid` int(11) NOT NULL DEFAULT '0',
  `num` int(11) NOT NULL DEFAULT '0' COMMENT '天每掉落的数量',
  PRIMARY KEY (`uid`),
  UNIQUE KEY `idx_uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_qiyue` (
  `uid` int(11) NOT NULL DEFAULT '0',
  `gid` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  KEY `uid_gid` (`uid`,`gid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_selled_armor` (
  `sid` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `armorid` int(11) NOT NULL COMMENT '装备ID',
  `hp` smallint(6) NOT NULL DEFAULT '0' COMMENT '装备耐久度',
  `hp_max` smallint(6) NOT NULL DEFAULT '0' COMMENT '备装当前最大耐久度',
  `hid` int(11) NOT NULL DEFAULT '0' COMMENT '目前在使用该装备的将领，０表示装备无人使用',
  `strong_level` int(11) DEFAULT '0',
  `strong_value` int(11) DEFAULT '0',
  `embed_pearls` varchar(255) DEFAULT '',
  `embed_holes` varchar(255) DEFAULT '' COMMENT '0:打开, 1:需要一级打孔器, 2:需要2级打孔器 3:不开的',
  `deified` varchar(255) DEFAULT NULL,
  `time` int(11) NOT NULL,
  PRIMARY KEY (`sid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_shop` (
  `uid` int(11) NOT NULL,
  `shopid` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  `price` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  `paytype` int(11) DEFAULT '-1' COMMENT '-1未知0元宝1礼金',
  KEY `uid` (`uid`,`shopid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_shop_buy_cnt` (
  `uid` int(11) NOT NULL,
  `sid` int(11) NOT NULL COMMENT 'cfg_shop的id',
  `count` tinyint(4) NOT NULL DEFAULT '1' COMMENT '该商品已经购买的次数',
  `paytype` int(11) DEFAULT '-1' COMMENT '-1未知0元宝1礼金2五珠钱3铜币',
  UNIQUE KEY `uid_sid` (`uid`,`sid`),
  KEY `idx_sid` (`sid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_soldier_convert` (
  `uid` int(11) NOT NULL,
  `cid` int(11) NOT NULL,
  `fromSid` int(11) NOT NULL,
  `fromCount` int(11) NOT NULL,
  `toSid` int(11) NOT NULL,
  `toCount` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  KEY `uid_cid` (`uid`,`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_task` (
  `uid` int(11) NOT NULL,
  `tid` int(11) NOT NULL COMMENT '任务tid',
  `count` int(11) NOT NULL DEFAULT '1',
  `time` int(11) NOT NULL,
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='任务完成次数log';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_task_epic` (
  `uid` int(11) NOT NULL,
  `tid` int(11) NOT NULL COMMENT '史诗任务tid',
  `count` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='史诗任务完成次数log;';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_things` (
  `uid` int(11) NOT NULL,
  `tid` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  `type` int(11) NOT NULL COMMENT '0:玩家使用\r\n1:野地刷出\r\n2:商场购买\r\n3:宝箱刷出\r\n4:任务奖励\r\n5:GM操作\r\n6:礼包赠送\r\n7:赏赐\r\n8:礼券兑换',
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_things_type` (
  `id` tinyint(4) NOT NULL,
  `name` varchar(30) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_user_action` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `aid` int(11) NOT NULL COMMENT '用户点击操作id',
  `time` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `aid_time` (`aid`,`time`),
  KEY `uid` (`uid`)
) ENGINE=MyISAM AUTO_INCREMENT=2076 DEFAULT CHARSET=utf8 COMMENT='用户点击操作日志记录';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_user_level` (
  `rank` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `levelname` varchar(255) DEFAULT NULL,
  `level` varchar(255) DEFAULT NULL,
  `nobility` varchar(255) DEFAULT NULL,
  `battle` int(11) DEFAULT NULL,
  `prestige` int(11) NOT NULL DEFAULT '0',
  `reward` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否已经领奖，0未领奖，1已经领奖',
  `time` int(11) NOT NULL COMMENT '领取时间',
  `hero_level` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`rank`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_user_level_add` (
  `uid` int(11) NOT NULL,
  `startlevel` tinyint(4) NOT NULL,
  `endlevel` tinyint(4) NOT NULL,
  `time` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_warprestige` (
  `attackuid` int(11) NOT NULL,
  `resistuid` int(11) NOT NULL,
  `attackdie` int(11) NOT NULL,
  `resistdie` int(11) NOT NULL,
  `prestigeadd` int(11) NOT NULL,
  `time` int(11) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_workshop_fresh` (
  `id` int(6) NOT NULL AUTO_INCREMENT,
  `uid` int(6) DEFAULT NULL,
  `gidStr` varchar(99) DEFAULT NULL,
  `cost` int(6) DEFAULT NULL,
  `time` int(15) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `login_user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` char(64) NOT NULL,
  `pass` char(64) NOT NULL,
  `passport` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `luoyang_progress` (
  `union_id` int(11) NOT NULL DEFAULT '0' COMMENT '户用联盟id，对应到sys_union表里面的键',
  `tid` int(11) NOT NULL COMMENT '务任id，对应到cfg_task里面的键',
  `group` int(11) NOT NULL COMMENT '任务组',
  `name` char(32) NOT NULL COMMENT '任务名称',
  `maxvalue` int(11) NOT NULL COMMENT '要需交多少次',
  `curvalue` int(11) NOT NULL DEFAULT '0' COMMENT '已经完成多少次',
  PRIMARY KEY (`union_id`,`tid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_assemble` (
  `rank` int(11) NOT NULL DEFAULT '0',
  `uid` int(11) NOT NULL DEFAULT '0',
  `rewardid` int(11) NOT NULL DEFAULT '0' COMMENT '奖励物品id',
  `count` int(11) NOT NULL DEFAULT '0' COMMENT '奖励数量',
  `level` int(11) NOT NULL DEFAULT '0',
  `endtime` int(11) NOT NULL DEFAULT '0' COMMENT '领取奖励的时间',
  PRIMARY KEY (`uid`),
  UNIQUE KEY `idx_uid_rank` (`uid`,`rank`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_assemble_hero` (
  `uid` int(11) NOT NULL DEFAULT '0',
  `hid1` int(11) NOT NULL DEFAULT '0',
  `hid2` int(11) NOT NULL DEFAULT '0',
  `hid3` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_assemble_record` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fromuid` int(11) NOT NULL DEFAULT '0',
  `touid` int(11) NOT NULL DEFAULT '0',
  `flag` int(11) NOT NULL DEFAULT '0' COMMENT '1为攻击方胜利，0为防守方胜利',
  `rewardid` int(11) NOT NULL DEFAULT '-99' COMMENT '奖励id',
  `rewardcount` int(11) NOT NULL DEFAULT '0' COMMENT '奖励数量',
  `times` int(11) NOT NULL DEFAULT '0' COMMENT '攻击方连胜次数',
  `attackrank` int(11) NOT NULL DEFAULT '0' COMMENT '攻击后攻击方排名',
  `resistrank` int(11) NOT NULL DEFAULT '0' COMMENT '攻击后防守方排名',
  `rKingLevel` int(11) NOT NULL DEFAULT '0' COMMENT '防守方将领的修为等级',
  `ischange` int(11) NOT NULL DEFAULT '0' COMMENT '攻击后双方是否改变的排名',
  `time` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_time` (`time`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_assemble_win_record` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fromuid` int(11) NOT NULL DEFAULT '0',
  `touid` int(11) NOT NULL DEFAULT '0',
  `times` int(11) NOT NULL DEFAULT '0' COMMENT '连胜次数',
  `rKingLevel` int(11) NOT NULL DEFAULT '0' COMMENT '防守方将领的修为等级',
  `last_challenge_time` int(11) NOT NULL DEFAULT '0' COMMENT '最后一次挑战时间',
  PRIMARY KEY (`id`),
  KEY `idx_lct` (`last_challenge_time`),
  KEY `idx_times` (`times`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_attack_skill` (
  `battleid` int(11) NOT NULL,
  `skill` tinyint(4) NOT NULL,
  `round` tinyint(4) NOT NULL,
  `delay` tinyint(4) NOT NULL,
  UNIQUE KEY `battle_skill` (`battleid`,`skill`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_battle` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` int(11) NOT NULL DEFAULT '0',
  `round` int(11) NOT NULL DEFAULT '0',
  `attackcid` int(11) NOT NULL DEFAULT '0',
  `attackhid` int(11) NOT NULL DEFAULT '0',
  `attacksoldiers` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `attackpos` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `attackadd` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `resistcid` int(11) NOT NULL DEFAULT '0',
  `resisthid` int(11) NOT NULL DEFAULT '0',
  `resistsoldiers` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `resistpos` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `resistadd` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `resistdefence` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `wallhp` int(11) NOT NULL DEFAULT '0',
  `walllevel` int(11) NOT NULL DEFAULT '0',
  `fieldrange` int(11) NOT NULL DEFAULT '0',
  `nexttime` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  `level` int(11) NOT NULL DEFAULT '0',
  `attackstartcid` int(11) NOT NULL DEFAULT '0',
  `resiststartcid` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `nexttime` (`nexttime`)
) ENGINE=MyISAM AUTO_INCREMENT=193 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_battle_army_copy` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) DEFAULT NULL,
  `tid` int(4) DEFAULT NULL,
  `cid` int(6) DEFAULT NULL,
  `sid` int(11) DEFAULT '0',
  `count` int(11) DEFAULT NULL,
  `sidname` char(20) DEFAULT NULL,
  `people_need` int(11) DEFAULT NULL,
  `type` smallint(4) DEFAULT '0' COMMENT '0为士兵1为城防',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_battle_attack_lock` (
  `battlefieldid` int(11) NOT NULL DEFAULT '0',
  `cid` int(11) NOT NULL DEFAULT '0',
  `uid` int(11) NOT NULL DEFAULT '0',
  `msg` char(100) NOT NULL DEFAULT '',
  KEY `battlefieldid` (`battlefieldid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_battle_event` (
  `battlefieldid` int(11) NOT NULL DEFAULT '0',
  `uid` int(11) NOT NULL DEFAULT '0',
  `unionid` int(11) NOT NULL DEFAULT '0',
  `bid` int(11) NOT NULL DEFAULT '0',
  `event_type` int(11) NOT NULL DEFAULT '0',
  `trigger_id` int(11) NOT NULL DEFAULT '0',
  `troop_id` int(11) NOT NULL DEFAULT '0',
  KEY `battlefieldid` (`battlefieldid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_battle_event_mark` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `battlefieldid` int(11) NOT NULL DEFAULT '0',
  `mark_id` int(11) NOT NULL DEFAULT '0',
  `option1` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `battlefieldid` (`battlefieldid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_battle_tactics` (
  `battleid` int(11) NOT NULL,
  `attack` tinyint(4) NOT NULL,
  `stype` tinyint(4) NOT NULL,
  `action` tinyint(4) NOT NULL,
  `target` tinyint(4) NOT NULL,
  `action2` tinyint(4) NOT NULL,
  `target2` tinyint(4) NOT NULL,
  UNIQUE KEY `stype` (`battleid`,`attack`,`stype`)
) ENGINE=MyISAM DEFAULT CHARSET=ascii;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_building_destroying` (
  `id` int(11) NOT NULL,
  `cid` int(11) NOT NULL DEFAULT '0',
  `xy` int(11) NOT NULL DEFAULT '0',
  `bid` int(11) NOT NULL DEFAULT '0',
  `level` int(11) NOT NULL DEFAULT '0',
  `state_endtime` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `cid` (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_building_upgrading` (
  `id` int(11) NOT NULL,
  `cid` int(11) NOT NULL DEFAULT '0',
  `xy` int(11) NOT NULL DEFAULT '0',
  `bid` int(11) NOT NULL DEFAULT '0',
  `level` int(11) NOT NULL DEFAULT '0',
  `state_endtime` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `cid` (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_cfg_boyname` (
  `id` int(11) NOT NULL,
  `name` char(10) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_cfg_firstname` (
  `id` int(11) NOT NULL,
  `name` char(10) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_cfg_girlname` (
  `id` int(11) NOT NULL,
  `name` char(10) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_city_autotrans` (
  `fromcid` int(11) NOT NULL DEFAULT '0',
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tocid` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  `res_type` int(11) NOT NULL DEFAULT '0',
  `count` int(11) NOT NULL DEFAULT '0',
  `trans_type` int(11) NOT NULL DEFAULT '0',
  `uid` int(11) NOT NULL DEFAULT '0',
  `start_time` int(11) NOT NULL DEFAULT '0',
  `distance` double NOT NULL DEFAULT '0',
  `end_time` int(11) NOT NULL DEFAULT '0',
  `cost_time` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_city_buffer` (
  `cid` int(11) NOT NULL,
  `buftype` int(11) NOT NULL COMMENT '类型：\r\n1:草木皆兵\r\n2:空城计\r\n3:抛砖引玉\r\n4:坚壁清野\r\n5:暗度陈仓\r\n8:十面埋伏',
  `bufparam` int(11) NOT NULL DEFAULT '0',
  `endtime` int(11) NOT NULL,
  UNIQUE KEY `cid_buf` (`cid`,`buftype`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_city_captive` (
  `cid` int(11) NOT NULL,
  `sid` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  UNIQUE KEY `cid_sid` (`cid`,`sid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_city_draft` (
  `id` int(11) NOT NULL,
  `cid` int(11) NOT NULL COMMENT '城市ID,也就是城市的位置',
  `xy` int(11) NOT NULL COMMENT '建筑位置\r\n编码方式是 (城内?1:0)*100 + x * 10 + y',
  `sid` int(11) NOT NULL DEFAULT '0' COMMENT '士兵ID',
  `count` int(11) NOT NULL,
  `state_endtime` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '该建筑状态结束时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `cid_xy` (`cid`,`xy`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='正在征的兵\r\n';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_city_lamster` (
  `count` int(11) NOT NULL,
  `sid` int(11) NOT NULL,
  `cid` int(11) NOT NULL,
  UNIQUE KEY `cid_sid` (`sid`,`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_city_reinforce` (
  `id` int(11) NOT NULL,
  `cid` int(11) NOT NULL COMMENT '城市ID,也就是城市的位置',
  `did` int(11) NOT NULL DEFAULT '0' COMMENT '士兵ID',
  `count` int(11) NOT NULL,
  `state_endtime` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '该建筑状态结束时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `cid_xy` (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='正在征的兵\r\n';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_city_resource` (
  `cid` int(11) unsigned NOT NULL COMMENT '城池ID',
  `morale` tinyint(4) NOT NULL DEFAULT '90',
  `morale_stable` tinyint(4) NOT NULL DEFAULT '90',
  `complaint` tinyint(4) NOT NULL DEFAULT '0',
  `tax` tinyint(4) NOT NULL DEFAULT '10',
  `wood` double NOT NULL DEFAULT '0' COMMENT '库存木材',
  `wood_add` double NOT NULL DEFAULT '100' COMMENT '木材产量',
  `wood_max` double NOT NULL DEFAULT '10000',
  `rock` double NOT NULL DEFAULT '0' COMMENT '库存石材',
  `rock_add` double NOT NULL DEFAULT '100' COMMENT '石材产量',
  `rock_max` double NOT NULL DEFAULT '10000',
  `iron` double NOT NULL DEFAULT '0' COMMENT '库存铁锭',
  `iron_add` double NOT NULL DEFAULT '100' COMMENT '铁锭产量',
  `iron_max` double NOT NULL DEFAULT '10000',
  `food` double NOT NULL DEFAULT '0' COMMENT '库存粮食',
  `food_add` double NOT NULL DEFAULT '100' COMMENT '粮食产量',
  `food_army_use` double NOT NULL DEFAULT '0',
  `food_max` double NOT NULL DEFAULT '10000',
  `gold` double unsigned NOT NULL DEFAULT '0' COMMENT '库存黄金',
  `hero_fee` double NOT NULL DEFAULT '0' COMMENT '将领薪水',
  `gold_max` double NOT NULL DEFAULT '1000000' COMMENT '黄金上限',
  `gold_rate` smallint(6) NOT NULL DEFAULT '100' COMMENT '黄金产量分倍率',
  `people` int(11) NOT NULL DEFAULT '0' COMMENT '当前总人口',
  `people_stable` int(11) NOT NULL DEFAULT '0' COMMENT '人品稳定值',
  `people_working` int(11) NOT NULL DEFAULT '0',
  `people_building` int(11) NOT NULL DEFAULT '0',
  `people_max` int(11) NOT NULL DEFAULT '100',
  `chief_loyalty` tinyint(4) NOT NULL DEFAULT '0',
  `changing` tinyint(4) NOT NULL DEFAULT '0',
  `lastupdate` int(11) NOT NULL DEFAULT '0',
  `vacation` tinyint(4) NOT NULL DEFAULT '0' COMMENT '０表示正常，１表示休假',
  `forbidden` tinyint(4) NOT NULL DEFAULT '0' COMMENT '０表示正常，１表示封禁',
  PRIMARY KEY (`cid`),
  KEY `idx_c_v_f` (`changing`,`vacation`,`forbidden`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='玩家拥有的所有城市';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_city_resource_bak` (
  `cid` int(11) unsigned NOT NULL COMMENT '城池ID',
  `morale` tinyint(4) NOT NULL DEFAULT '90',
  `morale_stable` tinyint(4) NOT NULL DEFAULT '90',
  `complaint` tinyint(4) NOT NULL DEFAULT '0',
  `tax` tinyint(4) NOT NULL DEFAULT '10',
  `wood` double NOT NULL DEFAULT '0' COMMENT '库存木材',
  `wood_add` double NOT NULL DEFAULT '100' COMMENT '木材产量',
  `wood_max` double NOT NULL DEFAULT '10000',
  `rock` double NOT NULL DEFAULT '0' COMMENT '库存石材',
  `rock_add` double NOT NULL DEFAULT '100' COMMENT '石材产量',
  `rock_max` double NOT NULL DEFAULT '10000',
  `iron` double NOT NULL DEFAULT '0' COMMENT '库存铁锭',
  `iron_add` double NOT NULL DEFAULT '100' COMMENT '铁锭产量',
  `iron_max` double NOT NULL DEFAULT '10000',
  `food` double NOT NULL DEFAULT '0' COMMENT '库存粮食',
  `food_add` double NOT NULL DEFAULT '100' COMMENT '粮食产量',
  `food_army_use` double NOT NULL DEFAULT '0',
  `food_max` double NOT NULL DEFAULT '10000',
  `gold` double unsigned NOT NULL DEFAULT '0' COMMENT '库存黄金',
  `hero_fee` double NOT NULL DEFAULT '0' COMMENT '将领薪水',
  `gold_max` double NOT NULL DEFAULT '1000000' COMMENT '黄金上限',
  `gold_rate` smallint(6) NOT NULL DEFAULT '100' COMMENT '黄金产量分倍率',
  `people` int(11) NOT NULL DEFAULT '0' COMMENT '当前总人口',
  `people_stable` int(11) NOT NULL DEFAULT '0' COMMENT '人品稳定值',
  `people_working` int(11) NOT NULL DEFAULT '0',
  `people_building` int(11) NOT NULL DEFAULT '0',
  `people_max` int(11) NOT NULL DEFAULT '100',
  `chief_loyalty` tinyint(4) NOT NULL DEFAULT '0',
  `changing` tinyint(4) NOT NULL DEFAULT '0',
  `lastupdate` int(11) NOT NULL DEFAULT '0',
  `vacation` tinyint(4) NOT NULL DEFAULT '0' COMMENT '０表示正常，１表示休假',
  `forbidden` tinyint(4) NOT NULL DEFAULT '0' COMMENT '０表示正常，１表示封禁',
  PRIMARY KEY (`cid`),
  KEY `idx_c_v_f` (`changing`,`vacation`,`forbidden`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='玩家拥有的所有城市';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_city_schedule` (
  `cid` int(11) NOT NULL,
  `create_time` int(11) NOT NULL DEFAULT '0' COMMENT '上次被占领时间',
  `last_govern_time` int(11) NOT NULL DEFAULT '0',
  `last_change_name` int(11) NOT NULL DEFAULT '0' COMMENT '上次修改城名时间',
  `last_levy_resource` int(11) NOT NULL DEFAULT '0' COMMENT '上次征收物资时间',
  `last_pacify_people` int(11) NOT NULL DEFAULT '0' COMMENT '上次安抚百姓时间',
  `next_good_event` int(11) NOT NULL DEFAULT '0' COMMENT '下一次天赐时间',
  `next_bad_event` int(11) NOT NULL DEFAULT '0' COMMENT '下一次天灾时间',
  `last_reset_recruit` int(11) NOT NULL DEFAULT '0',
  `last_reset_rumor` int(11) NOT NULL DEFAULT '0',
  `last_change_army` int(11) NOT NULL DEFAULT '0',
  `last_trick_morale` int(11) NOT NULL DEFAULT '0' COMMENT '被使用了妖言惑众之计的时间',
  `last_trick_weiweijiuzhao` int(11) NOT NULL DEFAULT '0',
  `last_trick_chenhuodajie` int(11) NOT NULL DEFAULT '0',
  `last_trick_maifu` int(11) NOT NULL DEFAULT '0' COMMENT '被使用了十面埋伏之计的时间',
  `last_anming` int(11) NOT NULL DEFAULT '0' COMMENT '使用安民告示时间',
  `govern_count` int(11) NOT NULL DEFAULT '0',
  `last_adv_move` int(11) NOT NULL DEFAULT '0' COMMENT '上次使用高级迁城时间',
  `last_be_govern_time` int(11) NOT NULL DEFAULT '0',
  `last_trick_fenshaoliangcao` int(11) NOT NULL DEFAULT '0',
  `last_trick_hudichouxin` int(11) DEFAULT '0',
  `last_trick_shangwuchouti` int(11) NOT NULL DEFAULT '0' COMMENT '最后一次被使用上屋抽梯的时间',
  PRIMARY KEY (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_city_schedule_bak` (
  `cid` int(11) NOT NULL,
  `create_time` int(11) NOT NULL DEFAULT '0' COMMENT '上次被占领时间',
  `last_govern_time` int(11) NOT NULL DEFAULT '0',
  `last_change_name` int(11) NOT NULL DEFAULT '0' COMMENT '上次修改城名时间',
  `last_levy_resource` int(11) NOT NULL DEFAULT '0' COMMENT '上次征收物资时间',
  `last_pacify_people` int(11) NOT NULL DEFAULT '0' COMMENT '上次安抚百姓时间',
  `next_good_event` int(11) NOT NULL DEFAULT '0' COMMENT '下一次天赐时间',
  `next_bad_event` int(11) NOT NULL DEFAULT '0' COMMENT '下一次天灾时间',
  `last_reset_recruit` int(11) NOT NULL DEFAULT '0',
  `last_reset_rumor` int(11) NOT NULL DEFAULT '0',
  `last_change_army` int(11) NOT NULL DEFAULT '0',
  `last_trick_morale` int(11) NOT NULL DEFAULT '0' COMMENT '被使用了妖言惑众之计的时间',
  `last_trick_weiweijiuzhao` int(11) NOT NULL DEFAULT '0',
  `last_trick_chenhuodajie` int(11) NOT NULL DEFAULT '0',
  `last_trick_maifu` int(11) NOT NULL DEFAULT '0' COMMENT '被使用了十面埋伏之计的时间',
  `last_anming` int(11) NOT NULL DEFAULT '0' COMMENT '使用安民告示时间',
  `govern_count` int(11) NOT NULL DEFAULT '0',
  `last_adv_move` int(11) NOT NULL DEFAULT '0' COMMENT '上次使用高级迁城时间',
  `last_be_govern_time` int(11) NOT NULL DEFAULT '0',
  `last_trick_fenshaoliangcao` int(11) NOT NULL DEFAULT '0',
  `last_trick_hudichouxin` int(11) DEFAULT '0',
  `last_trick_shangwuchouti` int(11) NOT NULL DEFAULT '0' COMMENT '最后一次被使用上屋抽梯的时间',
  PRIMARY KEY (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_city_trade` (
  `id` int(11) NOT NULL,
  `endtime` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_city_wounded` (
  `cid` int(11) NOT NULL,
  `sid` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  UNIQUE KEY `cid_sid` (`cid`,`sid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_hero_blood` (
  `hid` int(11) NOT NULL,
  `force` int(11) NOT NULL DEFAULT '0',
  `force_max` int(11) NOT NULL DEFAULT '0',
  `energy` int(11) NOT NULL DEFAULT '0',
  `energy_max` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_hero_buffer` (
  `hid` int(11) NOT NULL,
  `buftype` int(11) NOT NULL COMMENT '1：虎符\r\n2：文曲星符\r\n3：武曲星符\r\n4：智多星符 \r\n5:武魂 ',
  `endtime` int(11) NOT NULL,
  `bufparam` int(11) NOT NULL DEFAULT '0',
  UNIQUE KEY `buftype` (`hid`,`buftype`),
  KEY `endtime` (`endtime`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_hero_exile` (
  `hid` int(11) NOT NULL DEFAULT '0',
  `uid` int(11) NOT NULL DEFAULT '0',
  `loyalty` smallint(6) DEFAULT '0' COMMENT '忠诚',
  PRIMARY KEY (`hid`),
  KEY `uid` (`uid`),
  KEY `loyalty` (`loyalty`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='流亡将领';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_hero_schedule` (
  `hid` int(11) NOT NULL,
  `last_largess` int(11) NOT NULL DEFAULT '0',
  `last_trick` int(11) NOT NULL DEFAULT '0' COMMENT '上次中挑拨离间的时间',
  PRIMARY KEY (`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_hero_summon` (
  `hid` int(11) NOT NULL,
  `gid` int(11) NOT NULL,
  `name` char(20) NOT NULL,
  `count` int(11) NOT NULL,
  UNIQUE KEY `hid_gid` (`hid`,`gid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_lottery_goods` (
  `uid` int(11) DEFAULT NULL,
  `records` varchar(255) COLLATE utf8_bin DEFAULT NULL COMMENT '1~8等\r\ntype,id,count',
  `time` date DEFAULT NULL,
  `restart_count` tinyint(4) NOT NULL DEFAULT '0' COMMENT '重开次数',
  `got` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否领取,0:未领取，1:领取',
  `win` varchar(255) COLLATE utf8_bin NOT NULL DEFAULT '-1,0,0' COMMENT '获奖，格式type,id,count; type=0:物品，1:装备',
  UNIQUE KEY `uid_time` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_luoyang_event` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `name` char(32) NOT NULL,
  `unionname` char(32) NOT NULL,
  `cityname` char(32) NOT NULL,
  `touid` int(11) NOT NULL,
  `toname` char(32) NOT NULL,
  `tounionname` char(32) NOT NULL,
  `score` int(11) NOT NULL,
  `flag` tinyint(4) NOT NULL,
  `time` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_uid` (`uid`),
  KEY `idx_touid` (`touid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_luoyang_info` (
  `id` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  `starttime` int(11) NOT NULL DEFAULT '0',
  `endtime` int(11) NOT NULL DEFAULT '0',
  `round` int(11) NOT NULL DEFAULT '0'
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_luoyang_record` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `unionid` int(11) NOT NULL DEFAULT '0',
  `type` int(11) NOT NULL DEFAULT '0',
  `uid` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_maneuver` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `state` tinyint(4) NOT NULL COMMENT 'çŠ¶æ€\r\n0ï¼šç­‰å¾…æ¼”ä¹ \r\n1ï¼šæ¼”ä¹ ç»“æŸ',
  `result` tinyint(4) NOT NULL DEFAULT '0',
  `round` tinyint(4) NOT NULL DEFAULT '0',
  `attacksoldiers` char(255) CHARACTER SET ascii NOT NULL COMMENT 'num:sid,count,sid,count...',
  `resistsoldiers` char(255) CHARACTER SET ascii NOT NULL,
  `attackadd` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `resistadd` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `wallhp` int(11) NOT NULL DEFAULT '0',
  `attackdie` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `resistdie` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=29 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_marry_during` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `hid` int(11) NOT NULL COMMENT '夫人hid',
  `starttime` int(11) NOT NULL DEFAULT '0' COMMENT '怀孕开始的时间',
  `endtime` int(11) NOT NULL DEFAULT '0' COMMENT '怀孕结束的时间',
  `isSpeed` int(11) NOT NULL DEFAULT '0' COMMENT '怀孕期间是否加速过，0：没有加速，1：加速过',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_uid_hid` (`uid`,`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='夫人怀孕期间数据表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_marry_hero_favor` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `hid` int(11) NOT NULL COMMENT '夫人hid',
  `favor` int(11) NOT NULL DEFAULT '0' COMMENT '好感度',
  `state` int(11) NOT NULL DEFAULT '0' COMMENT '0：谈情说爱阶段，1：夫人赠送礼品阶段,2：怀孕阶段，3：可以接生了',
  `count` int(11) NOT NULL DEFAULT '0' COMMENT '该女将作为夫人拥有孩子的个数',
  `coolingEndtime` int(11) NOT NULL DEFAULT '0' COMMENT '生完孩子后的冷却结束',
  `proposeCoolTime` int(11) NOT NULL DEFAULT '0' COMMENT '提亲冷却时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_uid_hid` (`uid`,`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='玩家与女将的好感度关系表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_marry_relation` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `mHid` int(11) NOT NULL COMMENT '母亲的hid',
  `shid` int(11) NOT NULL COMMENT '孩子的hid',
  `state` int(11) NOT NULL DEFAULT '0' COMMENT '0：保存母子培养关系，1：孩子周游列国去了，2：孩子被解雇了，3：逃亡状态，4：保存母子将领状态',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_uid_mhid_shid` (`uid`,`mHid`,`shid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='母亲和孩子的对应关系';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_queue` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `sid` int(11) NOT NULL,
  `ip` int(11) NOT NULL,
  `lastupdate` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_resist_skill` (
  `battleid` int(11) NOT NULL,
  `skill` tinyint(4) NOT NULL,
  `round` tinyint(4) NOT NULL,
  `delay` tinyint(4) NOT NULL,
  UNIQUE KEY `battle_skill` (`battleid`,`skill`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_state` (
  `state` int(11) NOT NULL,
  `value` int(11) NOT NULL DEFAULT '0',
  `description` char(100) NOT NULL,
  PRIMARY KEY (`state`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_state_copy` (
  `state` int(11) NOT NULL,
  `value` int(11) NOT NULL DEFAULT '0',
  `description` char(100) NOT NULL,
  PRIMARY KEY (`state`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_technic_upgrading` (
  `id` int(11) NOT NULL,
  `cid` int(11) NOT NULL DEFAULT '0',
  `tid` int(11) NOT NULL DEFAULT '0',
  `level` int(11) NOT NULL DEFAULT '0',
  `state_endtime` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `cid` (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_treasure_map` (
  `uid` int(11) NOT NULL,
  `endtime` int(11) NOT NULL,
  `cid` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_troops_buffer` (
  `buftype` int(11) NOT NULL,
  `troopid` int(11) NOT NULL,
  `endtime` int(11) NOT NULL,
  `bufparam` int(11) NOT NULL DEFAULT '0',
  UNIQUE KEY `tid_buf` (`buftype`,`troopid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_union_buf` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL COMMENT '玩家ID',
  `nick` char(64) NOT NULL DEFAULT '' COMMENT '用户昵称',
  `union_id` int(11) NOT NULL COMMENT '盟联ID',
  `state` tinyint(4) NOT NULL COMMENT '玩家状态，０表示退出联盟，１表示加入联盟,',
  `updatetime` int(11) NOT NULL COMMENT '记录插入时间',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_union_event` (
  `unionid` int(11) NOT NULL,
  `type` tinyint(4) NOT NULL COMMENT '事件类型',
  `content` char(255) NOT NULL COMMENT '事件内容',
  `evttime` int(11) NOT NULL COMMENT '事件发生时间'
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_union_relation` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` tinyint(4) NOT NULL COMMENT '关系：0：友好，2：敌对',
  `unionid` int(11) NOT NULL COMMENT '己方联盟',
  `target` int(11) NOT NULL COMMENT '目标联盟',
  `time` int(11) NOT NULL DEFAULT '0' COMMENT '上次申请时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_u_t` (`unionid`,`target`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_union_remove` (
  `douid` int(11) NOT NULL DEFAULT '0',
  `uid` int(11) NOT NULL DEFAULT '0',
  `unionid` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_user_buffer` (
  `uid` int(11) NOT NULL,
  `buftype` int(11) NOT NULL DEFAULT '0' COMMENT 'buffer类型\r\n1:神农锄\r\n2:鲁班斧\r\n3:开山锤\r\n4:玄铁炉\r\n5:陷阵战鼓\r\n6:八卦阵图\r\n7:免战中\r\n8:免战冷却\r\n9:青囊书\r\n10:清仓令\r\n11:徭役令\r\n12:考工记1\r\n13:考工记2\r\n14:考工记3',
  `endtime` int(11) NOT NULL COMMENT '结束时间',
  `bufparam` int(11) NOT NULL DEFAULT '0',
  UNIQUE KEY `uid_buf` (`uid`,`buftype`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_user_inwar` (
  `uid` int(11) NOT NULL,
  `targetuid` int(11) NOT NULL,
  `state` tinyint(4) NOT NULL DEFAULT '0' COMMENT '状态，0：宣战冷却，1：宣战中',
  `endtime` int(11) NOT NULL,
  UNIQUE KEY `uid_uid` (`uid`,`targetuid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_user_schedule` (
  `uid` int(11) NOT NULL,
  `last_daily_gift` int(11) NOT NULL DEFAULT '0' COMMENT '每日送宝时间',
  `start_new_protect` int(11) NOT NULL DEFAULT '0',
  `last_trick_war` int(11) NOT NULL DEFAULT '0',
  `today_war_count` smallint(6) DEFAULT '0',
  `last_reset_sys_task` int(11) DEFAULT '0',
  `last_persuade` int(11) NOT NULL DEFAULT '0' COMMENT '上次使用巧舌游说时间',
  `last_release_hero` int(11) NOT NULL DEFAULT '0' COMMENT '上次发布专属任务的武将id',
  `lastlogingif` int(11) DEFAULT NULL,
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_user_systask_num` (
  `uid` int(11) NOT NULL,
  `count` int(11) NOT NULL DEFAULT '0' COMMENT '玩家一天刷新的随机任务次数',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_user_trickwar` (
  `uid` int(11) NOT NULL,
  `targetuid` int(11) NOT NULL,
  `endtime` int(11) NOT NULL,
  UNIQUE KEY `uid` (`uid`,`targetuid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_war_buf` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL COMMENT '玩家ID',
  `nick` char(65) NOT NULL COMMENT '用户昵称',
  `battleid` int(11) NOT NULL COMMENT '战场ID',
  `unionid` int(11) NOT NULL COMMENT '战场联盟ID',
  `state` tinyint(4) NOT NULL COMMENT '玩家状态',
  `updatetime` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 ROW_FORMAT=FIXED;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_world` (
  `wid` int(11) NOT NULL,
  `type` tinyint(4) NOT NULL COMMENT '格子地型：\r\n0:城池;\r\n1:平地;\r\n2:沙漠;\r\n3:森林;\r\n4:草地;\r\n5:高山;\r\n6:湖泊;\r\n7:沼泽;\r\n',
  `ownercid` int(11) NOT NULL DEFAULT '0' COMMENT '归属城池,0代表野地',
  `state` tinyint(4) NOT NULL DEFAULT '0' COMMENT '当前地点状态\r\n0:和平\r\n1:战乱',
  `level` tinyint(4) NOT NULL DEFAULT '0' COMMENT '级别',
  `maxlevel` tinyint(4) NOT NULL,
  `updatetime` int(11) NOT NULL DEFAULT '0',
  `province` tinyint(4) NOT NULL DEFAULT '0' COMMENT '州',
  `jun` tinyint(4) NOT NULL DEFAULT '0',
  PRIMARY KEY (`wid`),
  KEY `idx_ownerid_status_type` (`ownercid`,`state`,`type`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mem_world_schedule` (
  `wid` int(11) NOT NULL,
  `last_create_npc` int(11) NOT NULL DEFAULT '0',
  `last_create_defence` int(11) NOT NULL,
  PRIMARY KEY (`wid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pay_day_money` (
  `day` int(11) NOT NULL,
  `money` int(11) NOT NULL,
  PRIMARY KEY (`day`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pay_key` (
  `name` char(20) CHARACTER SET ascii NOT NULL,
  `key` char(50) CHARACTER SET ascii NOT NULL,
  `ip` char(20) CHARACTER SET ascii NOT NULL DEFAULT '',
  PRIMARY KEY (`ip`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pay_log` (
  `orderid` varchar(64) NOT NULL,
  `type` tinyint(4) NOT NULL,
  `payname` varchar(64) NOT NULL,
  `passport` varchar(64) NOT NULL,
  `passtype` varchar(64) NOT NULL,
  `money` int(11) NOT NULL,
  `code` varchar(64) NOT NULL,
  `time` int(11) NOT NULL,
  UNIQUE KEY `orderid` (`orderid`),
  KEY `pp` (`passtype`,`passport`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pay_request` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `money` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  `reason` char(100) NOT NULL DEFAULT '',
  `adminid` int(11) NOT NULL,
  `state` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:请求中\r\n1:已经处理\r\n2:取消',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pay_user_gift` (
  `uid` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_achivement` (
  `uid` int(11) NOT NULL,
  `rank` int(11) NOT NULL DEFAULT '0',
  `point` int(11) NOT NULL DEFAULT '0',
  KEY `uid` (`uid`),
  KEY `rank` (`rank`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_activity` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '名排',
  `uid` int(11) NOT NULL,
  `name` varchar(32) NOT NULL COMMENT '玩家君主名',
  `sort3` varchar(64) NOT NULL COMMENT '第一排序数值',
  `sort4` varchar(64) NOT NULL COMMENT '第二排序数值',
  `sort5` varchar(64) NOT NULL COMMENT '第三排序数值',
  PRIMARY KEY (`rank`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_activity_today` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '名排',
  `uid` int(11) NOT NULL,
  `name` varchar(32) NOT NULL COMMENT '玩家君主名',
  `sort3` varchar(64) NOT NULL COMMENT '第一排序数值',
  `sort4` varchar(64) NOT NULL COMMENT '第二排序数值',
  `sort5` varchar(64) NOT NULL COMMENT '第三排序数值',
  PRIMARY KEY (`rank`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_activity_yesterday` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '名排',
  `uid` int(11) NOT NULL,
  `name` varchar(32) NOT NULL COMMENT '玩家君主名',
  `sort3` varchar(64) NOT NULL COMMENT '第一排序数值',
  `sort4` varchar(64) NOT NULL COMMENT '第二排序数值',
  `sort5` varchar(64) NOT NULL COMMENT '第三排序数值',
  PRIMARY KEY (`rank`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_battle_day` (
  `rank` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL DEFAULT '0',
  `name` char(32) NOT NULL,
  `unionname` char(32) DEFAULT NULL,
  `total` int(32) DEFAULT '0',
  `day` int(11) NOT NULL DEFAULT '0',
  `week` int(11) DEFAULT '0',
  PRIMARY KEY (`rank`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_battle_total` (
  `rank` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL DEFAULT '0',
  `name` char(32) NOT NULL,
  `unionname` char(32) DEFAULT NULL,
  `total` int(32) DEFAULT '0',
  `day` int(11) NOT NULL DEFAULT '0',
  `week` int(11) DEFAULT '0',
  PRIMARY KEY (`rank`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_battle_week` (
  `rank` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `name` char(32) NOT NULL,
  `unionname` char(32) DEFAULT NULL,
  `total` int(11) DEFAULT '0',
  `day` int(11) DEFAULT '0',
  `week` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`rank`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_city` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '排名',
  `name` char(32) NOT NULL COMMENT '城池名',
  `type` tinyint(4) NOT NULL DEFAULT '0',
  `user` char(32) NOT NULL COMMENT '君主',
  `union` char(32) NOT NULL COMMENT '联盟',
  `cid` int(11) NOT NULL COMMENT '城池id(位置)',
  `people` int(11) NOT NULL COMMENT '人口数',
  `uid` int(11) DEFAULT '0',
  PRIMARY KEY (`rank`),
  KEY `idx_name` (`name`),
  KEY `idx_cid` (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_city_type` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '排名',
  `name` char(32) NOT NULL COMMENT '城池名',
  `type` tinyint(4) NOT NULL DEFAULT '0',
  `user` char(32) NOT NULL COMMENT '君主',
  `union` char(32) NOT NULL COMMENT '联盟',
  `cid` int(11) NOT NULL COMMENT '城池id(位置)',
  `people` int(11) NOT NULL COMMENT '人口数',
  `uid` int(11) DEFAULT '0',
  PRIMARY KEY (`rank`),
  KEY `idx_name` (`name`),
  KEY `idx_cid` (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_gongpin` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `uid` int(11) NOT NULL,
  `name` char(32) NOT NULL COMMENT '玩家君主名',
  `union` char(32) NOT NULL COMMENT '玩家联盟名字',
  `jungong` int(11) NOT NULL DEFAULT '0' COMMENT '军功册数量',
  `juanxian` int(11) NOT NULL DEFAULT '0' COMMENT '捐献薄',
  `qinwang` int(11) NOT NULL DEFAULT '0' COMMENT '勤王诏',
  `gongpin` int(11) NOT NULL DEFAULT '0' COMMENT '贡品录',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_uid` (`uid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_gongpin_union` (
  `rank` int(11) NOT NULL AUTO_INCREMENT,
  `unionid` int(11) NOT NULL COMMENT '盟联ID',
  `name` char(32) NOT NULL COMMENT '联盟名字',
  `leader` char(32) NOT NULL COMMENT '盟主',
  `jungong` int(11) NOT NULL DEFAULT '0' COMMENT '军功册数量',
  `juanxian` int(11) NOT NULL DEFAULT '0' COMMENT '捐献薄',
  `qinwang` int(11) NOT NULL DEFAULT '0' COMMENT '勤王诏',
  `gongpin` int(11) NOT NULL DEFAULT '0' COMMENT '贡品录',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_unionid` (`unionid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_hero` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '排名',
  `hid` int(11) NOT NULL COMMENT '武将的ID',
  `name` char(32) NOT NULL COMMENT '武将名',
  `user` char(32) DEFAULT '',
  `level` smallint(6) NOT NULL COMMENT '等级',
  `affairs` smallint(6) NOT NULL COMMENT '内政',
  `bravery` smallint(6) NOT NULL COMMENT '勇武',
  `wisdom` smallint(6) NOT NULL COMMENT '智谋',
  `uid` int(11) DEFAULT NULL,
  `command` smallint(6) NOT NULL COMMENT '统率',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_hid` (`hid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=926 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_hero_affairs` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '排名',
  `hid` int(11) NOT NULL COMMENT '武将的ID',
  `name` char(32) NOT NULL COMMENT '武将名',
  `user` char(32) DEFAULT '',
  `level` smallint(6) NOT NULL COMMENT '等级',
  `affairs` smallint(6) NOT NULL COMMENT '内政',
  `bravery` smallint(6) NOT NULL COMMENT '勇武',
  `wisdom` smallint(6) NOT NULL COMMENT '智谋',
  `uid` int(11) DEFAULT NULL,
  `command` smallint(6) NOT NULL COMMENT '统率',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_hid` (`hid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=926 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_hero_bravery` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '排名',
  `hid` int(11) NOT NULL COMMENT '武将的ID',
  `name` char(32) NOT NULL COMMENT '武将名',
  `user` char(32) DEFAULT '',
  `level` smallint(6) NOT NULL COMMENT '等级',
  `affairs` smallint(6) NOT NULL COMMENT '内政',
  `bravery` smallint(6) NOT NULL COMMENT '勇武',
  `wisdom` smallint(6) NOT NULL COMMENT '智谋',
  `uid` int(11) DEFAULT NULL,
  `command` smallint(6) NOT NULL COMMENT '统率',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_hid` (`hid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=926 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_hero_command` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '排名',
  `hid` int(11) NOT NULL COMMENT '武将的ID',
  `name` char(32) NOT NULL COMMENT '武将名',
  `user` char(32) DEFAULT '',
  `level` smallint(6) NOT NULL COMMENT '等级',
  `affairs` smallint(6) NOT NULL COMMENT '内政',
  `bravery` smallint(6) NOT NULL COMMENT '勇武',
  `wisdom` smallint(6) NOT NULL COMMENT '智谋',
  `uid` int(11) DEFAULT NULL,
  `command` smallint(6) NOT NULL COMMENT '统率',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_hid` (`hid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=926 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_hero_wisdom` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '排名',
  `hid` int(11) NOT NULL COMMENT '武将的ID',
  `name` char(32) NOT NULL COMMENT '武将名',
  `user` char(32) DEFAULT '',
  `level` smallint(6) NOT NULL COMMENT '等级',
  `affairs` smallint(6) NOT NULL COMMENT '内政',
  `bravery` smallint(6) NOT NULL COMMENT '勇武',
  `wisdom` smallint(6) NOT NULL COMMENT '智谋',
  `uid` int(11) DEFAULT NULL,
  `command` smallint(6) NOT NULL COMMENT '统率',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_hid` (`hid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=926 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_juanxian` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `uid` int(11) NOT NULL,
  `name` char(32) NOT NULL COMMENT '玩家君主名',
  `union` char(32) NOT NULL COMMENT '玩家联盟名字',
  `jungong` int(11) NOT NULL DEFAULT '0' COMMENT '军功册数量',
  `juanxian` int(11) NOT NULL DEFAULT '0' COMMENT '捐献薄',
  `qinwang` int(11) NOT NULL DEFAULT '0' COMMENT '勤王诏',
  `gongpin` int(11) NOT NULL DEFAULT '0' COMMENT '贡品录',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_uid` (`uid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_juanxian_union` (
  `rank` int(11) NOT NULL AUTO_INCREMENT,
  `unionid` int(11) NOT NULL COMMENT '盟联ID',
  `name` char(32) NOT NULL COMMENT '联盟名字',
  `leader` char(32) NOT NULL COMMENT '盟主',
  `jungong` int(11) NOT NULL DEFAULT '0' COMMENT '军功册数量',
  `juanxian` int(11) NOT NULL DEFAULT '0' COMMENT '捐献薄',
  `qinwang` int(11) NOT NULL DEFAULT '0' COMMENT '勤王诏',
  `gongpin` int(11) NOT NULL DEFAULT '0' COMMENT '贡品录',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_unionid` (`unionid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_jungong` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `uid` int(11) NOT NULL,
  `name` char(32) NOT NULL COMMENT '玩家君主名',
  `union` char(32) NOT NULL COMMENT '玩家联盟名字',
  `jungong` int(11) NOT NULL DEFAULT '0' COMMENT '军功册数量',
  `juanxian` int(11) NOT NULL DEFAULT '0' COMMENT '捐献薄',
  `qinwang` int(11) NOT NULL DEFAULT '0' COMMENT '勤王诏',
  `gongpin` int(11) NOT NULL DEFAULT '0' COMMENT '贡品录',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_uid` (`uid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_jungong_union` (
  `rank` int(11) NOT NULL AUTO_INCREMENT,
  `unionid` int(11) NOT NULL COMMENT '盟联ID',
  `name` char(32) NOT NULL COMMENT '联盟名字',
  `leader` char(32) NOT NULL COMMENT '盟主',
  `jungong` int(11) NOT NULL DEFAULT '0' COMMENT '军功册数量',
  `juanxian` int(11) NOT NULL DEFAULT '0' COMMENT '捐献薄',
  `qinwang` int(11) NOT NULL DEFAULT '0' COMMENT '勤王诏',
  `gongpin` int(11) NOT NULL DEFAULT '0' COMMENT '贡品录',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_unionid` (`unionid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_military` (
  `rank` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(32) NOT NULL,
  `unionname` char(32) DEFAULT '',
  `army` int(11) NOT NULL DEFAULT '0',
  `attack` int(11) NOT NULL DEFAULT '0',
  `defence` int(11) NOT NULL DEFAULT '0',
  `uid` int(11) DEFAULT NULL,
  PRIMARY KEY (`rank`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_military_attack` (
  `rank` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(32) NOT NULL,
  `unionname` char(32) DEFAULT '',
  `attack` int(11) NOT NULL DEFAULT '0',
  `defence` int(11) NOT NULL DEFAULT '0',
  `army` int(11) NOT NULL DEFAULT '0',
  `uid` int(11) DEFAULT NULL,
  PRIMARY KEY (`rank`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_military_defence` (
  `rank` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(32) NOT NULL,
  `unionname` char(32) DEFAULT '',
  `army` int(11) NOT NULL DEFAULT '0',
  `attack` int(11) NOT NULL DEFAULT '0',
  `defence` int(11) NOT NULL DEFAULT '0',
  `uid` int(11) DEFAULT NULL,
  PRIMARY KEY (`rank`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_qinwang` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `uid` int(11) NOT NULL,
  `name` char(32) NOT NULL COMMENT '玩家君主名',
  `union` char(32) NOT NULL COMMENT '玩家联盟名字',
  `jungong` int(11) NOT NULL DEFAULT '0' COMMENT '军功册数量',
  `juanxian` int(11) NOT NULL DEFAULT '0' COMMENT '捐献薄',
  `qinwang` int(11) NOT NULL DEFAULT '0' COMMENT '勤王诏',
  `gongpin` int(11) NOT NULL DEFAULT '0' COMMENT '贡品录',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_uid` (`uid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_qinwang_union` (
  `rank` int(11) NOT NULL AUTO_INCREMENT,
  `unionid` int(11) NOT NULL COMMENT '盟联ID',
  `name` char(32) NOT NULL COMMENT '联盟名字',
  `leader` char(32) NOT NULL COMMENT '盟主',
  `jungong` int(11) NOT NULL DEFAULT '0' COMMENT '军功册数量',
  `juanxian` int(11) NOT NULL DEFAULT '0' COMMENT '捐献薄',
  `qinwang` int(11) NOT NULL DEFAULT '0' COMMENT '勤王诏',
  `gongpin` int(11) NOT NULL DEFAULT '0' COMMENT '贡品录',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_unionid` (`unionid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_rich` (
  `total` int(11) NOT NULL DEFAULT '0',
  `rank` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(32) NOT NULL,
  `unionname` char(32) DEFAULT NULL,
  `day` int(11) DEFAULT '0',
  `month` int(11) DEFAULT '0',
  `uid` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`rank`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_rich_day` (
  `rank` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL DEFAULT '0',
  `name` char(32) NOT NULL,
  `unionname` char(32) DEFAULT NULL,
  `total` int(32) DEFAULT '0',
  `day` int(11) NOT NULL DEFAULT '0',
  `month` int(11) DEFAULT '0',
  PRIMARY KEY (`rank`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_rich_month` (
  `rank` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `name` char(32) NOT NULL,
  `unionname` char(32) DEFAULT NULL,
  `total` int(11) DEFAULT '0',
  `day` int(11) DEFAULT '0',
  `month` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`rank`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_union` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '排名',
  `uid` int(11) NOT NULL COMMENT '联盟ID',
  `name` char(32) NOT NULL COMMENT '盟联',
  `leader` char(32) NOT NULL COMMENT '盟主',
  `member` smallint(6) NOT NULL COMMENT '成员数',
  `famouscity` smallint(6) NOT NULL DEFAULT '0',
  `prestige` int(11) NOT NULL COMMENT '声望',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_uid` (`uid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_union_city` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT 'æŽ’å',
  `uid` int(11) NOT NULL COMMENT 'è”ç›ŸID',
  `name` char(32) NOT NULL COMMENT 'è”ç›Ÿå',
  `leader` char(32) NOT NULL COMMENT 'ç›Ÿä¸»',
  `member` smallint(6) NOT NULL COMMENT 'æˆå‘˜æ•°',
  `famouscity` smallint(6) NOT NULL DEFAULT '0' COMMENT 'å é¢†ååŸŽæ•°',
  `prestige` int(11) NOT NULL COMMENT 'å£°æœ›',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_uid` (`uid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8 COMMENT='è”ç›Ÿéœ¸ä¸šæŽ’è¡Œ';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_user` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '排名',
  `uid` int(11) NOT NULL,
  `name` char(32) NOT NULL COMMENT '君主',
  `union` char(32) DEFAULT '' COMMENT '联盟',
  `nobility` char(32) NOT NULL,
  `prestige` int(11) NOT NULL COMMENT '声望',
  `city` smallint(6) NOT NULL COMMENT '城池数',
  `people` int(11) NOT NULL COMMENT '人口数',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_uid` (`uid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_user_level` (
  `rank` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `levelname` varchar(255) DEFAULT NULL,
  `level` varchar(255) DEFAULT NULL,
  `nobility` varchar(255) DEFAULT NULL,
  `battle` int(11) DEFAULT NULL,
  `prestige` int(11) NOT NULL DEFAULT '0',
  `hero_level` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`rank`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rank_user_prestige` (
  `rank` int(11) NOT NULL AUTO_INCREMENT COMMENT '排名',
  `uid` int(11) NOT NULL,
  `name` char(32) NOT NULL COMMENT '君主',
  `union` char(32) DEFAULT '' COMMENT '联盟',
  `nobility` char(32) NOT NULL,
  `prestige` int(11) NOT NULL COMMENT '声望',
  `city` smallint(6) NOT NULL COMMENT '城池数',
  `people` int(11) NOT NULL COMMENT '人口数',
  PRIMARY KEY (`rank`),
  UNIQUE KEY `idx_uid` (`uid`),
  KEY `idx_name` (`name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_activity` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `inuse` tinyint(4) NOT NULL DEFAULT '0',
  `content` char(255) NOT NULL,
  `link` char(255) NOT NULL,
  `interval` int(11) NOT NULL DEFAULT '5',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_alarm` (
  `uid` int(11) NOT NULL,
  `troops` tinyint(4) NOT NULL DEFAULT '0',
  `enemy` tinyint(4) NOT NULL DEFAULT '0',
  `report` tinyint(4) NOT NULL DEFAULT '0',
  `mail` tinyint(4) NOT NULL DEFAULT '0',
  `friend` tinyint(4) NOT NULL DEFAULT '0',
  `task` tinyint(4) NOT NULL DEFAULT '0',
  `union` tinyint(4) NOT NULL DEFAULT '0',
  `battle` tinyint(4) DEFAULT '0',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_allow_auto_discard` (
  `uid` int(11) NOT NULL AUTO_INCREMENT,
  `allow` tinyint(4) NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM AUTO_INCREMENT=1003 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_allow_union_troop` (
  `uid` int(11) NOT NULL,
  `allow` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否允许盟友驻军\r\n０：禁止\r\n１：允许',
  `anti_invade` tinyint(4) NOT NULL DEFAULT '1',
  `anti_plunder` tinyint(4) NOT NULL DEFAULT '1',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_allowpk` (
  `uid` int(11) NOT NULL,
  `allow` tinyint(4) DEFAULT NULL,
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_announce` (
  `id` int(11) NOT NULL,
  `content` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_armor_addon` (
  `sid` int(11) NOT NULL,
  `attid` int(11) NOT NULL,
  `value` int(11) NOT NULL,
  PRIMARY KEY (`sid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_armor_special` (
  `sid` int(11) NOT NULL,
  `type` int(11) NOT NULL DEFAULT '0' COMMENT '0:没有特效;1:加属性;2:重伤;3:降级建筑;4:将领速度;5:战场距离',
  PRIMARY KEY (`sid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_attack_position` (
  `uid` int(11) NOT NULL,
  `cid` int(11) NOT NULL DEFAULT '0',
  `tid` int(11) NOT NULL DEFAULT '0',
  `goods` int(11) NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL DEFAULT '',
  `state` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`,`tid`),
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_auth_serial` (
  `code` varchar(64) NOT NULL DEFAULT '',
  `used` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`code`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_battle` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cid` int(11) NOT NULL,
  `type` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  `result` int(11) NOT NULL DEFAULT '0',
  `attackuid` int(11) NOT NULL DEFAULT '0',
  `resistuid` int(11) NOT NULL DEFAULT '0',
  `attacktroop` int(11) NOT NULL DEFAULT '0',
  `resisttroops` int(11) NOT NULL DEFAULT '0',
  `resistdefence` int(11) NOT NULL DEFAULT '0',
  `starttime` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `cid` (`cid`)
) ENGINE=MyISAM AUTO_INCREMENT=193 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_battle_city` (
  `cid` int(11) NOT NULL,
  `uid` int(11) NOT NULL DEFAULT '0',
  `unionid` int(11) NOT NULL DEFAULT '0',
  `ownerunionid` int(11) NOT NULL DEFAULT '0',
  `xy` int(11) NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL DEFAULT '',
  `image` int(11) NOT NULL DEFAULT '0',
  `winpoint` int(11) NOT NULL DEFAULT '0',
  `losepoint` int(11) NOT NULL DEFAULT '0',
  `rate` int(11) NOT NULL DEFAULT '0',
  `drop` int(11) NOT NULL DEFAULT '0',
  `reinforce_soldiers` int(11) NOT NULL DEFAULT '0',
  `battlefieldid` int(11) NOT NULL DEFAULT '0',
  `can_quest` int(11) NOT NULL DEFAULT '0',
  `hasuser` int(11) NOT NULL DEFAULT '0',
  `nextxy` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_battle_invite` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fromuid` int(11) NOT NULL,
  `battlename` char(100) NOT NULL,
  `battlefieldid` int(11) NOT NULL,
  `level` smallint(6) NOT NULL DEFAULT '1',
  `time` int(11) NOT NULL,
  `touid` int(11) NOT NULL,
  `state` tinyint(4) NOT NULL DEFAULT '0',
  `fromname` char(50) NOT NULL,
  `toname` char(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_battle_open_condition` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `battleId` int(11) NOT NULL DEFAULT '0' COMMENT '场战ID',
  `dependBattleId` int(11) NOT NULL DEFAULT '0' COMMENT '依赖战场ID',
  `otherCondition` varchar(100) DEFAULT '' COMMENT '其他条件',
  `isConditionDoing` tinyint(4) NOT NULL DEFAULT '0' COMMENT '标记依赖的条件是否处在正在被实现的阶段',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=13 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_battle_reinforce` (
  `troopid` int(11) NOT NULL,
  `sid` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  `type` int(11) NOT NULL DEFAULT '0' COMMENT '0 通过援军令召唤 1 通过战场事件奖励军队',
  PRIMARY KEY (`troopid`,`sid`,`type`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_battle_report` (
  `battleid` int(11) NOT NULL DEFAULT '0',
  `report` text,
  `round` int(11) NOT NULL DEFAULT '0',
  KEY `battleid` (`battleid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_battle_winpoint` (
  `point` int(11) NOT NULL DEFAULT '0',
  `battlefieldid` int(11) NOT NULL DEFAULT '0',
  `unionid` int(11) NOT NULL DEFAULT '0',
  KEY `battlefieldid` (`battlefieldid`,`unionid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_building` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cid` int(11) NOT NULL,
  `xy` int(11) NOT NULL,
  `bid` int(11) NOT NULL DEFAULT '0',
  `level` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  `state_endtime` int(11) NOT NULL DEFAULT '0',
  `state_starttime` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `cid_xy` (`cid`,`xy`),
  KEY `cid` (`cid`)
) ENGINE=MyISAM AUTO_INCREMENT=306593 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_building_backup` (
  `uid` int(11) NOT NULL COMMENT '玩家ID',
  `bid` tinyint(4) NOT NULL COMMENT '建筑ID',
  `xy` int(11) NOT NULL COMMENT '建筑位置',
  `level` tinyint(4) NOT NULL COMMENT '建筑等级',
  `time` int(11) NOT NULL COMMENT '被灭时间',
  KEY `idx_uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_building_bak` (
  `cid` int(11) NOT NULL,
  `xy` int(11) NOT NULL DEFAULT '0',
  `bid` int(11) NOT NULL DEFAULT '0',
  `level` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  KEY `cid` (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_cdkey` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` tinyint(4) NOT NULL COMMENT '类型，０表示白银CDKEY，１表示黄金CDKEY',
  `cdkey` char(12) CHARACTER SET ascii NOT NULL COMMENT 'CDKEY',
  `uid` int(11) NOT NULL DEFAULT '0' COMMENT '领取的用户，０表示未用',
  `time` int(11) NOT NULL DEFAULT '0' COMMENT '领取时间',
  `remark` tinyint(4) NOT NULL DEFAULT '0' COMMENT '获得徐径 ０表示天赐褔禄活动，１表示天书残卷活动',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_chat_apply` (
  `uid` int(11) NOT NULL,
  `name` char(32) NOT NULL COMMENT '玩家名字',
  `time` int(11) NOT NULL COMMENT '申请时间',
  `status` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:未处理\r\n1:正在处理\r\n2:处理完毕',
  `content` text NOT NULL COMMENT '题问内容',
  `admid` int(11) NOT NULL DEFAULT '0',
  `admname` char(32) NOT NULL DEFAULT '' COMMENT '处理该请求的GM',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_chat_forbidden` (
  `uid` int(11) NOT NULL COMMENT '户用UID',
  `public` int(11) NOT NULL DEFAULT '0' COMMENT '公聊频道禁言时间',
  `union` int(11) NOT NULL DEFAULT '0' COMMENT '联盟频道禁言时间',
  `private` int(11) NOT NULL DEFAULT '0' COMMENT '聊私禁言时间',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_chat_word` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `word` char(64) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL COMMENT '聊天要被屏蔽的关键字',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_word` (`word`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city` (
  `cid` int(11) unsigned NOT NULL COMMENT '城池ID',
  `uid` int(11) NOT NULL DEFAULT '0',
  `name` char(30) NOT NULL COMMENT '城池名',
  `type` tinyint(4) DEFAULT NULL COMMENT '类型\r\n0:玩家城池\r\n1:名城\r\n2:郡城\r\n3:州城\r\n4:都城\r\n5:玩家主城',
  `state` tinyint(4) NOT NULL DEFAULT '0' COMMENT '城池状态\r\n0：正常;1：新手保护;\r\n2：免战;3：休假',
  `chiefhid` int(11) NOT NULL DEFAULT '0',
  `province` tinyint(4) NOT NULL DEFAULT '0' COMMENT '州',
  `discardtime` int(11) NOT NULL DEFAULT '0',
  `counsellorid` int(11) NOT NULL DEFAULT '0',
  `generalid` int(11) NOT NULL DEFAULT '0',
  `conscript` int(11) NOT NULL DEFAULT '0' COMMENT '否是可以募兵，0表示不可以，1表示可以，大于2，最后招募时间',
  `is_special` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`cid`),
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='玩家拥有的所有城市';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_area` (
  `cid` int(11) NOT NULL,
  `area` int(11) NOT NULL,
  PRIMARY KEY (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_bak` (
  `cid` int(11) unsigned NOT NULL COMMENT '城池ID',
  `uid` int(11) NOT NULL DEFAULT '0',
  `name` char(30) NOT NULL COMMENT '城池名',
  `type` tinyint(4) DEFAULT NULL COMMENT '类型\r\n0:玩家城池\r\n1:名城\r\n2:郡城\r\n3:州城\r\n4:都城\r\n5:玩家主城',
  `state` tinyint(4) NOT NULL DEFAULT '0' COMMENT '城池状态\r\n0：正常;1：新手保护;\r\n2：免战;3：休假',
  `chiefhid` int(11) NOT NULL DEFAULT '0',
  `province` tinyint(4) NOT NULL DEFAULT '0' COMMENT '州',
  `discardtime` int(11) NOT NULL DEFAULT '0',
  `counsellorid` int(11) NOT NULL DEFAULT '0',
  `generalid` int(11) NOT NULL DEFAULT '0',
  `conscript` tinyint(4) NOT NULL DEFAULT '0' COMMENT '否是可以募兵，0表示不可以，1表示可以，2,已经募兵每天名城被改成可以一次',
  `is_special` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`cid`),
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='玩家拥有的所有城市';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_commission_task` (
  `cid` int(11) NOT NULL,
  `tid` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  `endtime` int(11) NOT NULL DEFAULT '0',
  KEY `cid` (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_defence` (
  `cid` int(11) NOT NULL COMMENT '城市ID,也就是城市的位置',
  `did` int(11) NOT NULL DEFAULT '0' COMMENT '建筑ID,默认为0,代表无建筑',
  `count` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '士兵数量',
  UNIQUE KEY `cid_xy` (`cid`,`did`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='玩家拥有的所有建筑\r\n';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_defence_bak` (
  `cid` int(11) NOT NULL COMMENT '城市ID,也就是城市的位置',
  `did` int(11) NOT NULL DEFAULT '0' COMMENT '建筑ID,默认为0,代表无建筑',
  `count` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '士兵数量',
  UNIQUE KEY `cid_xy` (`cid`,`did`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='玩家拥有的所有建筑\r\n';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_draftqueue` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cid` int(11) NOT NULL COMMENT '城市ID,也就是城市的位置',
  `xy` int(11) NOT NULL COMMENT '建筑位置\r\n编码方式是 (城内?1:0)*10000 + x * 100 + y',
  `sid` int(11) NOT NULL DEFAULT '0' COMMENT '士兵ID',
  `count` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '个数',
  `queuetime` int(11) NOT NULL DEFAULT '0' COMMENT '开始排队的时间，按这个时间顺序建设',
  `state` tinyint(3) unsigned NOT NULL DEFAULT '0' COMMENT '是否正在征兵中',
  `draft_interval` int(11) NOT NULL,
  `state_starttime` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '征兵开始时间',
  `needtime` int(11) NOT NULL DEFAULT '0' COMMENT '这个队列需要的时间',
  `accmark` tinyint(4) NOT NULL DEFAULT '0' COMMENT '速加标记',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=145 DEFAULT CHARSET=utf8 COMMENT='玩家拥有的所有建筑\r\n';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_hero` (
  `hid` int(11) NOT NULL AUTO_INCREMENT COMMENT '英雄ID',
  `uid` int(11) NOT NULL COMMENT '归属哪个玩家，如果是NPC的话，为0',
  `name` char(16) NOT NULL DEFAULT '' COMMENT '名字',
  `npcid` smallint(6) NOT NULL DEFAULT '0',
  `sex` tinyint(4) NOT NULL,
  `face` smallint(6) NOT NULL,
  `cid` int(11) NOT NULL COMMENT '所属城池',
  `state` tinyint(4) NOT NULL DEFAULT '0' COMMENT '状态：0，空闲；1,城守；2,出征，3,战斗,4，驻守,5,俘虏',
  `level` smallint(6) NOT NULL DEFAULT '1' COMMENT '级别',
  `exp` int(11) NOT NULL DEFAULT '0' COMMENT '经验值',
  `command_base` smallint(6) NOT NULL DEFAULT '0' COMMENT '领将的统率',
  `command_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '率统加成',
  `affairs_base` smallint(6) NOT NULL DEFAULT '0' COMMENT '内政',
  `bravery_base` smallint(6) NOT NULL DEFAULT '0' COMMENT '勇武',
  `wisdom_base` smallint(6) NOT NULL DEFAULT '0' COMMENT '智谋',
  `affairs_add` smallint(6) NOT NULL DEFAULT '0',
  `bravery_add` smallint(6) NOT NULL DEFAULT '0',
  `wisdom_add` smallint(6) NOT NULL DEFAULT '0',
  `affairs_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '政内加成',
  `bravery_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '勇武加成',
  `wisdom_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '智谋加成',
  `force_max_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '体力加成',
  `energy_max_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '精力加成',
  `speed_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '速度加成',
  `attack_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '攻击加成',
  `defence_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '防御加成',
  `loyalty` smallint(6) NOT NULL DEFAULT '0' COMMENT '忠诚',
  `herotype` smallint(6) NOT NULL DEFAULT '0' COMMENT '将领类型,0普通武将，1黄巾活动武将,2聚贤包开出武将,3-9圣诞武将',
  `hero_health` tinyint(4) NOT NULL DEFAULT '0' COMMENT '状态：0，健康；1，重伤；2，修养',
  PRIMARY KEY (`hid`),
  KEY `idx_uid` (`uid`),
  KEY `cid` (`cid`),
  KEY `npcid` (`npcid`),
  KEY `hero_health` (`hero_health`)
) ENGINE=MyISAM AUTO_INCREMENT=80303 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_hero_base_add` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `hid` int(11) NOT NULL COMMENT '英雄ID',
  `uid` int(11) NOT NULL COMMENT '归属哪个玩家，如果是NPC的话，为0',
  `command_base_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '基础统率加点',
  `affairs_base_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '基础内政加点',
  `bravery_base_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '基础勇武加点',
  `wisdom_base_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '基础智谋加点',
  `type` smallint(6) NOT NULL DEFAULT '0' COMMENT '基础加点类型 1:将领历练获得 2：武魂加成',
  PRIMARY KEY (`id`),
  KEY `idx_hid` (`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='将领基础属性永久加点';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_hero_trade` (
  `uid` int(11) NOT NULL,
  `cid` int(11) NOT NULL DEFAULT '0',
  `hid` int(11) NOT NULL DEFAULT '0',
  `npcid` int(11) NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL DEFAULT '',
  `level` int(11) NOT NULL DEFAULT '0',
  `sex` int(11) NOT NULL DEFAULT '0',
  `face` int(11) NOT NULL DEFAULT '0',
  `exp` int(11) NOT NULL DEFAULT '0',
  `price` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  `command_base` int(11) NOT NULL DEFAULT '0',
  `affairs_base` int(11) NOT NULL DEFAULT '0',
  `bravery_base` int(11) NOT NULL DEFAULT '0',
  `wisdom_base` int(11) NOT NULL DEFAULT '0',
  KEY `cid` (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_merchant` (
  `cid` int(11) NOT NULL,
  `wood` int(11) NOT NULL DEFAULT '0',
  `food` int(11) NOT NULL DEFAULT '0',
  `rock` int(11) NOT NULL DEFAULT '0',
  `iron` int(11) NOT NULL DEFAULT '0',
  `gold` int(11) NOT NULL DEFAULT '0',
  `trade_day` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_reinforcequeue` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cid` int(11) NOT NULL COMMENT '城市ID,也就是城市的位置',
  `did` int(11) NOT NULL DEFAULT '0' COMMENT '士兵ID',
  `count` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '个数',
  `queuetime` int(11) NOT NULL DEFAULT '0' COMMENT '开始排队的时间，按这个时间顺序建设',
  `state` tinyint(3) unsigned NOT NULL DEFAULT '0' COMMENT '是否正在征兵中',
  `reinforce_interval` int(11) NOT NULL,
  `state_starttime` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '征兵开始时间',
  `needtime` int(11) NOT NULL DEFAULT '0' COMMENT '总时间',
  `accmark` tinyint(4) NOT NULL DEFAULT '0' COMMENT '速加标记',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=16 DEFAULT CHARSET=utf8 COMMENT='玩家拥有的所有建筑\r\n';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_res_add` (
  `cid` int(11) unsigned NOT NULL COMMENT '城池ID',
  `food_rate` tinyint(4) NOT NULL DEFAULT '100' COMMENT '粮食生产比例',
  `wood_rate` tinyint(4) NOT NULL DEFAULT '100' COMMENT '木材生产比例',
  `rock_rate` tinyint(4) NOT NULL DEFAULT '100' COMMENT '石料生产比例',
  `iron_rate` tinyint(4) NOT NULL DEFAULT '100' COMMENT '铁锭生产比例',
  `food_store` tinyint(4) NOT NULL DEFAULT '25',
  `wood_store` tinyint(4) NOT NULL DEFAULT '25',
  `rock_store` tinyint(4) NOT NULL DEFAULT '25',
  `iron_store` tinyint(4) NOT NULL DEFAULT '25',
  `field_food_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '野地对粮食加成',
  `field_wood_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '野地对木材加成',
  `field_rock_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '野地对石料加成',
  `field_iron_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '野地对铁锭加成',
  `goods_food_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '物品对粮食加成',
  `goods_wood_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '物品对木材加成',
  `goods_rock_add` smallint(6) NOT NULL DEFAULT '0',
  `goods_iron_add` smallint(6) NOT NULL DEFAULT '0',
  `chief_add` smallint(6) NOT NULL DEFAULT '0',
  `resource_changing` tinyint(4) NOT NULL DEFAULT '0' COMMENT '资源生产率相关的数据修改过了',
  `skill_food_add` int(11) NOT NULL DEFAULT '0',
  `skill_wood_add` int(11) NOT NULL DEFAULT '0',
  `skill_rock_add` int(11) NOT NULL DEFAULT '0',
  `skill_iron_add` int(11) NOT NULL DEFAULT '0',
  `skill_gold_add` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='玩家拥有的所有城市';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_res_add_bak` (
  `cid` int(11) unsigned NOT NULL COMMENT '城池ID',
  `food_rate` tinyint(4) NOT NULL DEFAULT '100' COMMENT '粮食生产比例',
  `wood_rate` tinyint(4) NOT NULL DEFAULT '100' COMMENT '木材生产比例',
  `rock_rate` tinyint(4) NOT NULL DEFAULT '100' COMMENT '石料生产比例',
  `iron_rate` tinyint(4) NOT NULL DEFAULT '100' COMMENT '铁锭生产比例',
  `food_store` tinyint(4) NOT NULL DEFAULT '25',
  `wood_store` tinyint(4) NOT NULL DEFAULT '25',
  `rock_store` tinyint(4) NOT NULL DEFAULT '25',
  `iron_store` tinyint(4) NOT NULL DEFAULT '25',
  `field_food_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '野地对粮食加成',
  `field_wood_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '野地对木材加成',
  `field_rock_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '野地对石料加成',
  `field_iron_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '野地对铁锭加成',
  `goods_food_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '物品对粮食加成',
  `goods_wood_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '物品对木材加成',
  `goods_rock_add` smallint(6) NOT NULL DEFAULT '0',
  `goods_iron_add` smallint(6) NOT NULL DEFAULT '0',
  `chief_add` smallint(6) NOT NULL DEFAULT '0',
  `resource_changing` tinyint(4) NOT NULL DEFAULT '0' COMMENT '资源生产率相关的数据修改过了',
  `skill_food_add` int(11) NOT NULL DEFAULT '0',
  `skill_wood_add` int(11) NOT NULL DEFAULT '0',
  `skill_rock_add` int(11) NOT NULL DEFAULT '0',
  `skill_iron_add` int(11) NOT NULL DEFAULT '0',
  `skill_gold_add` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='玩家拥有的所有城市';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_rumor` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cid` int(11) NOT NULL,
  `name` char(30) NOT NULL,
  `type` tinyint(4) NOT NULL DEFAULT '0' COMMENT '0:将领，1：任务物品',
  `typeid` int(11) NOT NULL,
  `price` smallint(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=365 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_soldier` (
  `cid` int(11) NOT NULL COMMENT '城市ID,也就是城市的位置',
  `sid` int(11) NOT NULL DEFAULT '0' COMMENT '建筑ID,默认为0,代表无建筑',
  `count` int(11) NOT NULL DEFAULT '0' COMMENT '士兵数量',
  UNIQUE KEY `cid_xy` (`cid`,`sid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='玩家拥有的所有建筑\r\n';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_sys_task` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cid` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `cid` (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_tactics` (
  `cid` int(11) NOT NULL,
  `deplunder_join` char(255) CHARACTER SET ascii NOT NULL,
  `deplunder` text CHARACTER SET ascii NOT NULL,
  `depatrol_join` char(255) CHARACTER SET ascii NOT NULL,
  `depatrol` text CHARACTER SET ascii NOT NULL,
  `deinvade_join` char(255) CHARACTER SET ascii NOT NULL,
  `deinvade` text CHARACTER SET ascii NOT NULL,
  PRIMARY KEY (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_tactics_bak` (
  `cid` int(11) NOT NULL,
  `deplunder_join` char(255) CHARACTER SET ascii NOT NULL,
  `deplunder` text CHARACTER SET ascii NOT NULL,
  `depatrol_join` char(255) CHARACTER SET ascii NOT NULL,
  `depatrol` text CHARACTER SET ascii NOT NULL,
  `deinvade_join` char(255) CHARACTER SET ascii NOT NULL,
  `deinvade` text CHARACTER SET ascii NOT NULL,
  PRIMARY KEY (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_technic` (
  `cid` int(11) NOT NULL,
  `tid` int(11) NOT NULL,
  `level` tinyint(4) NOT NULL,
  UNIQUE KEY `cid_tid` (`cid`,`tid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_technic_bak` (
  `cid` int(11) NOT NULL,
  `tid` int(11) NOT NULL,
  `level` tinyint(4) NOT NULL,
  UNIQUE KEY `cid_tid` (`cid`,`tid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_city_trade` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cid` int(11) NOT NULL,
  `state` tinyint(4) NOT NULL DEFAULT '0' COMMENT '当前状态：0:wait; 1:onway',
  `restype` tinyint(4) NOT NULL DEFAULT '0' COMMENT '资源类型：0=>food;1=>wood;2=>rock;3=>iron',
  `count` double NOT NULL,
  `price` double NOT NULL,
  `gold` double NOT NULL,
  `distance` double NOT NULL DEFAULT '0',
  `endtime` int(11) NOT NULL DEFAULT '0',
  `buycid` int(11) NOT NULL DEFAULT '0',
  `unionid` int(11) NOT NULL DEFAULT '0' COMMENT '允许买的联盟\r\n0表示所有人都可以买\r\n非０表示只能该盟的人买',
  `limittime` int(11) NOT NULL DEFAULT '3600' COMMENT '交易上限时间',
  PRIMARY KEY (`id`),
  KEY `idx_distance` (`distance`),
  KEY `idx_cid` (`cid`)
) ENGINE=MyISAM AUTO_INCREMENT=21 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_enemy_troop_filter` (
  `cid` int(11) NOT NULL,
  `action` int(11) NOT NULL DEFAULT '0',
  `count` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_favourites` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `cid` int(11) unsigned NOT NULL DEFAULT '0',
  `name` char(30) NOT NULL,
  `comments` char(250) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uid_cid` (`uid`,`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_gather` (
  `wid` int(11) NOT NULL,
  `troopid` int(11) NOT NULL,
  `fooduse` int(11) NOT NULL,
  `level` int(11) NOT NULL,
  `starttime` int(11) NOT NULL,
  PRIMARY KEY (`wid`),
  UNIQUE KEY `troopid` (`troopid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_goods` (
  `uid` int(11) NOT NULL COMMENT '玩家ID',
  `gid` int(11) NOT NULL COMMENT '物品ID',
  `count` int(11) NOT NULL,
  UNIQUE KEY `uid_gid` (`uid`,`gid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_goods_copper` (
  `gid` int(11) NOT NULL,
  `type` int(11) NOT NULL,
  UNIQUE KEY `idx_gid_type_2` (`gid`,`type`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_hero_act` (
  `uid` int(11) NOT NULL,
  `hid` int(11) NOT NULL,
  `name` char(16) NOT NULL DEFAULT '',
  `state` int(11) NOT NULL DEFAULT '0' COMMENT '0，专属任务；1，任命；2，招降；3，公共任务'
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_hero_act_reward` (
  `hid` int(11) NOT NULL,
  `type` int(11) NOT NULL DEFAULT '0',
  `goods` int(11) NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL DEFAULT '',
  KEY `hid` (`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_hero_armor` (
  `hid` int(11) NOT NULL COMMENT '领将ID',
  `spart` tinyint(4) NOT NULL COMMENT '备装部件位置\r\n10：头部\r\n20：颈部\r\n30：肩部\r\n40：胸部\r\n50：背部\r\n60：腰部\r\n70：手臂\r\n80：脚部\r\n90：手指\r\n91：手指\r\n100：饰品\r\n101：饰品\r\n110：武器\r\n111：武器\r\n112：武器\r\n120：坐骑',
  `sid` int(11) NOT NULL COMMENT '装备在sys_user_arm表里的序号，主要用在一个玩家有多个同样的装备的时候，区别哪个是给将领装备了的，哪个是还在包包里的',
  `armorid` int(11) NOT NULL COMMENT '装备ID',
  UNIQUE KEY `idx_hid_part` (`hid`,`spart`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_hero_attribute` (
  `hid` int(11) NOT NULL COMMENT '将领ID',
  `attid` int(11) NOT NULL COMMENT '属性id',
  `value` int(11) NOT NULL COMMENT '属性值',
  UNIQUE KEY `idx_hid_attid` (`hid`,`attid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_hero_captive` (
  `hid` int(11) NOT NULL,
  `uid` int(11) NOT NULL,
  `captivetime` int(11) NOT NULL COMMENT '被俘虏的时间',
  PRIMARY KEY (`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_hero_expr` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL COMMENT '玩家',
  `cid` int(11) NOT NULL COMMENT '城池',
  `hid` int(11) NOT NULL COMMENT '将领',
  `type` int(11) NOT NULL COMMENT '历练类型',
  `starttime` int(11) NOT NULL DEFAULT '0' COMMENT '历练出发时间',
  `endtime` int(11) NOT NULL DEFAULT '0' COMMENT '历练结束时间',
  `hours` smallint(6) NOT NULL DEFAULT '1' COMMENT '历练小时数',
  `carrymoney` smallint(6) NOT NULL DEFAULT '0' COMMENT '携带元宝数',
  `accTimes` smallint(6) NOT NULL DEFAULT '0' COMMENT '累计加速次数',
  `state` smallint(6) NOT NULL DEFAULT '0' COMMENT '0:历练过程中 1:返回途中',
  PRIMARY KEY (`id`),
  KEY `idx_state_endtime` (`state`,`endtime`),
  KEY `idx_cid` (`cid`),
  KEY `idx_hid` (`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='将领历练';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_hero_expr_reward` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL COMMENT '玩家编号',
  `cid` int(11) NOT NULL COMMENT '将领历练出发城池',
  `hid` int(11) NOT NULL COMMENT '将领编号',
  `type` int(11) NOT NULL COMMENT '公共奇遇订单类型',
  `sort` int(11) NOT NULL COMMENT '奖励类型1:普通道具，2:特殊道具，3:装备道具,4:基础属性,5:宝珠转换,6:强化装备,7:好感度',
  `money` int(11) NOT NULL COMMENT '需要花费的元宝数',
  `details` varchar(64) NOT NULL COMMENT '各种道具',
  `endtime` int(11) NOT NULL COMMENT '过期时间，默认为7天，因为战报只保留三天',
  PRIMARY KEY (`id`),
  KEY `uid_hid` (`uid`,`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='将领历练奖励记录';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_hero_rest` (
  `hid` int(11) NOT NULL,
  `endtime` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_hero_skill` (
  `hid` int(11) NOT NULL,
  `skill` int(11) NOT NULL,
  UNIQUE KEY `hid_skill` (`hid`,`skill`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_hero_tactics` (
  `hid` int(11) NOT NULL,
  `tactics_id` int(11) NOT NULL DEFAULT '0',
  `level` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  KEY `hid` (`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_hero_task` (
  `uid` int(11) NOT NULL,
  `tid` int(11) NOT NULL DEFAULT '0',
  `group` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  `endtime` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`,`group`,`tid`),
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_huodong` (
  `id` int(11) NOT NULL,
  `name` char(30) NOT NULL DEFAULT '',
  `starttime` char(20) CHARACTER SET ascii NOT NULL DEFAULT '',
  `endtime` char(20) CHARACTER SET ascii NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_info_alarm` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` int(11) NOT NULL COMMENT '信息显示样式，0: 成功提示那种样式',
  `uid` int(11) NOT NULL COMMENT 'uid',
  `info` varchar(255) NOT NULL COMMENT '信息',
  `time` int(11) NOT NULL DEFAULT '0' COMMENT '插入时间',
  PRIMARY KEY (`id`),
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_inform` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '息消ID',
  `type` tinyint(4) NOT NULL DEFAULT '0' COMMENT '息消ID，0表示在聊天框里的公告，1表示飘动公告',
  `inuse` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否开启，0表示未开启，1表示开启',
  `starttime` int(11) NOT NULL COMMENT '公告开始滚动时间',
  `endtime` int(11) NOT NULL COMMENT ' 公告停止滚动时间',
  `interval` int(11) NOT NULL COMMENT '隔间时间',
  `scrollcount` int(11) NOT NULL DEFAULT '1' COMMENT '动滚次数',
  `color` int(11) NOT NULL DEFAULT '16711680' COMMENT '公告颜色',
  `msg` text NOT NULL COMMENT '消息内容',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=23 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_king_expr` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL COMMENT '玩家',
  `cid` int(11) NOT NULL COMMENT '城池',
  `hid` int(11) NOT NULL COMMENT '将领',
  `type` int(11) NOT NULL DEFAULT '0' COMMENT '历练类型,0寻访红颜',
  `starttime` int(11) NOT NULL DEFAULT '0' COMMENT '历练出发时间',
  `endtime` int(11) NOT NULL DEFAULT '0' COMMENT '历练结束时间',
  `hours` smallint(6) NOT NULL DEFAULT '1' COMMENT '历练小时数',
  `accTimes` smallint(6) NOT NULL DEFAULT '0' COMMENT '累计加速次数',
  `state` smallint(6) NOT NULL DEFAULT '0' COMMENT '0:历练过程中 1:返回途中',
  PRIMARY KEY (`id`),
  KEY `idx_state_endtime` (`state`,`endtime`),
  KEY `idx_cid` (`cid`),
  KEY `idx_hid` (`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='君主历练';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_king_expr_reward` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `hid` int(11) DEFAULT '0' COMMENT '历练碰到女将领gid',
  `time` int(11) DEFAULT '0' COMMENT '奖励产生时间',
  `getFlag` int(11) NOT NULL DEFAULT '0' COMMENT '否是领取奖励，1领取，0未领取',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='君主历练奖励表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_lionize` (
  `uid` int(11) NOT NULL,
  `npcid` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  `friend` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`,`npcid`),
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_liquan` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` tinyint(4) NOT NULL DEFAULT '0',
  `code` char(15) CHARACTER SET ascii NOT NULL,
  `uid` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `_uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_login_announce` (
  `maxname` char(32) NOT NULL DEFAULT '',
  `maxpos` char(32) NOT NULL DEFAULT '',
  `maxnob` char(32) NOT NULL DEFAULT '',
  `maxattack` char(32) NOT NULL DEFAULT '',
  `maxdefence` char(32) NOT NULL DEFAULT '',
  `id` int(32) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_luoyang_info` (
  `uid` int(11) NOT NULL DEFAULT '0',
  `unionid` int(11) NOT NULL DEFAULT '0',
  `name` char(8) NOT NULL DEFAULT '0',
  `initname` char(8) NOT NULL DEFAULT '0',
  `count` tinyint(4) NOT NULL DEFAULT '0',
  `last_send_inform` int(11) NOT NULL DEFAULT '0' COMMENT '上次发送全服公告的时间',
  `last_use_buffer` int(11) NOT NULL DEFAULT '0' COMMENT '上次使用联盟诏安的时间'
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_luoyang_troops` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL COMMENT '玩家',
  `cid` int(11) NOT NULL COMMENT '城池',
  `hid` int(11) NOT NULL COMMENT '将领',
  `targetcid` int(11) NOT NULL DEFAULT '0' COMMENT '目标地点',
  `state` smallint(6) NOT NULL DEFAULT '0',
  `starttime` int(11) NOT NULL DEFAULT '0' COMMENT '出发时间',
  `pathtime` int(11) NOT NULL DEFAULT '0',
  `endtime` int(11) NOT NULL DEFAULT '0' COMMENT '结束时间',
  `soldiers` char(255) CHARACTER SET ascii NOT NULL DEFAULT '0' COMMENT '士兵，格式为\r\nnum:sid,cnt;sid,cnt....',
  `battleid` int(11) NOT NULL DEFAULT '0' COMMENT '发生战斗时的战斗ＩＤ',
  `startcid` int(11) NOT NULL DEFAULT '0',
  `unionid` int(11) NOT NULL DEFAULT '0',
  `lastcc` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_targetcid` (`targetcid`),
  KEY `idx_cid` (`cid`),
  KEY `idx_uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_mail_box` (
  `mid` int(11) NOT NULL AUTO_INCREMENT COMMENT '件信ID',
  `uid` int(11) NOT NULL COMMENT '发信人UID',
  `name` char(32) NOT NULL DEFAULT '' COMMENT '收信人名称',
  `fromuid` int(11) NOT NULL COMMENT '发件人UID',
  `fromname` char(32) NOT NULL DEFAULT '' COMMENT '发件人名字',
  `title` char(128) NOT NULL DEFAULT '' COMMENT '信件标题',
  `contentid` int(11) NOT NULL COMMENT '信件内容ID',
  `read` tinyint(4) NOT NULL DEFAULT '0' COMMENT '信件状态，０表示未读，１表示已读',
  `recvstate` tinyint(4) NOT NULL COMMENT '收件人看到的信件删除状态，０表示可见，１表示删除',
  `sendstate` tinyint(4) NOT NULL COMMENT '发件人看到的信件删除状态，０表示可见，１表示删除',
  `posttime` int(11) NOT NULL COMMENT '信件发送时间',
  `type` int(4) DEFAULT NULL,
  PRIMARY KEY (`mid`),
  KEY `idx_uid` (`uid`),
  KEY `idx_fuid` (`fromuid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_mail_content` (
  `mid` int(11) NOT NULL AUTO_INCREMENT,
  `content` text NOT NULL,
  `posttime` int(11) NOT NULL COMMENT '信件入库时间，便于删除',
  PRIMARY KEY (`mid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_mail_passport` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `passport` char(30) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL,
  `passtype` char(30) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL,
  `title` char(128) NOT NULL,
  `content` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `pass` (`passport`,`passtype`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_mail_sys_box` (
  `mid` int(11) NOT NULL AUTO_INCREMENT COMMENT '信件ID',
  `uid` int(11) NOT NULL COMMENT '玩家UID',
  `contentid` int(11) NOT NULL COMMENT '信件内容ID',
  `title` char(128) NOT NULL COMMENT '信件标题',
  `read` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否已读，０表示未读，１表示已读',
  `posttime` int(11) NOT NULL COMMENT '信件发送时间',
  PRIMARY KEY (`mid`),
  KEY `idx_uid` (`uid`)
) ENGINE=MyISAM AUTO_INCREMENT=16 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_mail_sys_content` (
  `mid` int(11) NOT NULL AUTO_INCREMENT COMMENT '信息ID',
  `content` text NOT NULL COMMENT '信件内容',
  `posttime` int(11) NOT NULL COMMENT '发送时间，便于删除过期信件',
  PRIMARY KEY (`mid`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_npc_attack` (
  `cid` int(11) NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `finish` tinyint(4) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_online` (
  `uid` int(11) NOT NULL,
  `lastupdate` int(11) NOT NULL DEFAULT '0',
  `onlineupdate` int(11) NOT NULL DEFAULT '0',
  `onlinetime` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`),
  KEY `lastupdate` (`lastupdate`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_pk_user` (
  `uid` int(11) NOT NULL,
  `normal` int(11) NOT NULL DEFAULT '1' COMMENT '普通类型,战役编号*100+当前战役关卡编号，第2战役第5关就是205',
  `special` int(11) NOT NULL DEFAULT '1' COMMENT '精英类型',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_plunder_log` (
  `attackuid` int(11) NOT NULL,
  `resistcid` int(11) NOT NULL,
  `time` int(11) NOT NULL,
  UNIQUE KEY `uid_cid_time` (`attackuid`,`resistcid`,`time`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_pub_reward_task` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `targetcid` int(11) NOT NULL COMMENT '被悬赏的目标坐标',
  `targetname` varchar(32) NOT NULL DEFAULT '' COMMENT '被悬赏的城池',
  `type` smallint(6) NOT NULL DEFAULT '0' COMMENT '悬赏任务类型',
  `goal` int(11) NOT NULL DEFAULT '0' COMMENT '任务目标',
  `endtime` int(11) NOT NULL,
  `money` int(11) NOT NULL,
  `number` int(11) NOT NULL COMMENT '少人多领取',
  `state` smallint(6) NOT NULL DEFAULT '0' COMMENT '0 未完成 1 完成',
  `uid` int(11) NOT NULL,
  `finishuid` int(11) NOT NULL DEFAULT '-1' COMMENT '-1:无人完成',
  `todo` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_question` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `question` char(255) NOT NULL,
  `option1` char(255) NOT NULL,
  `option2` char(255) NOT NULL,
  `option3` char(255) NOT NULL,
  `option4` char(255) NOT NULL,
  `answer` int(4) NOT NULL,
  `info` char(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=33 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_recruit_hero` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(15) NOT NULL,
  `npcid` smallint(6) NOT NULL DEFAULT '0',
  `sex` tinyint(4) NOT NULL,
  `face` smallint(6) NOT NULL,
  `cid` int(11) NOT NULL,
  `level` tinyint(4) NOT NULL,
  `exp` double NOT NULL,
  `affairs_add` smallint(6) NOT NULL DEFAULT '0',
  `bravery_add` smallint(6) NOT NULL DEFAULT '0',
  `wisdom_add` smallint(6) NOT NULL DEFAULT '0',
  `affairs_base` smallint(6) NOT NULL DEFAULT '0',
  `bravery_base` smallint(6) NOT NULL DEFAULT '0',
  `wisdom_base` smallint(6) NOT NULL DEFAULT '0',
  `loyalty` smallint(6) NOT NULL,
  `gold_need` double NOT NULL,
  `gen_time` int(11) NOT NULL,
  `herotype` smallint(6) NOT NULL DEFAULT '0' COMMENT '将领类型',
  `command_base` smallint(6) NOT NULL DEFAULT '0',
  `command_add` smallint(6) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `cid` (`cid`)
) ENGINE=MyISAM AUTO_INCREMENT=34841 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_report` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL DEFAULT '0' COMMENT 'UID',
  `origincid` int(11) NOT NULL DEFAULT '0' COMMENT '出发地',
  `origincity` char(32) NOT NULL DEFAULT '－－',
  `happencid` int(11) NOT NULL DEFAULT '0' COMMENT '发生地',
  `happencity` char(32) NOT NULL DEFAULT '－－',
  `title` tinyint(4) NOT NULL DEFAULT '0' COMMENT '主题索引',
  `type` tinyint(4) NOT NULL DEFAULT '3' COMMENT '战报分类',
  `time` int(11) NOT NULL DEFAULT '0' COMMENT '发送时间',
  `read` tinyint(4) NOT NULL DEFAULT '0' COMMENT '已读状态',
  `battleid` int(11) NOT NULL DEFAULT '0' COMMENT '战斗ID',
  `content` text NOT NULL COMMENT '报告内容',
  `state` tinyint(4) NOT NULL DEFAULT '0',
  `from_battlenet` tinyint(4) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `uid` (`uid`),
  KEY `time` (`time`),
  KEY `idx_uid_state_read` (`uid`,`state`,`read`)
) ENGINE=MyISAM AUTO_INCREMENT=684 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_sc_soldier` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL DEFAULT '0',
  `type` int(11) NOT NULL DEFAULT '0' COMMENT '配兵方案的编号，这个是固定的。',
  `soldiers` varchar(255) DEFAULT NULL COMMENT '兵种和兵力',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uid_type` (`uid`,`type`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_sc_troops` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL DEFAULT '0',
  `hid` int(11) NOT NULL DEFAULT '0',
  `soldiers` varchar(255) DEFAULT NULL COMMENT '玩家选定的兵力配置',
  `battleid` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uid_hid` (`uid`,`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_sc_user` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL DEFAULT '0',
  `point` int(11) NOT NULL DEFAULT '0' COMMENT '玩家沙场的积分',
  `remain` int(11) NOT NULL DEFAULT '5' COMMENT '还有多少场pk可以玩，玩完了用道具置0',
  `win` int(11) NOT NULL DEFAULT '0' COMMENT '天当赢才场数',
  `total_point` int(11) NOT NULL DEFAULT '0' COMMENT '历史积分',
  `total_win` int(11) NOT NULL DEFAULT '0' COMMENT '历史胜利场数',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_sc_waiting_queue` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL DEFAULT '0',
  `state` smallint(4) NOT NULL DEFAULT '0' COMMENT '0玩家在等待，1玩家进入作战',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_servers` (
  `server_id` int(11) NOT NULL DEFAULT '0',
  `server_name` varchar(255) NOT NULL DEFAULT '',
  `from_serverid` int(11) NOT NULL DEFAULT '0',
  KEY `server_name` (`server_name`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_sessions` (
  `uid` int(11) NOT NULL,
  `sid` varchar(64) DEFAULT NULL,
  `ip` int(11) NOT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `session_uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='玩家在线表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_shop_cron` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `enable` int(11) NOT NULL DEFAULT '1',
  `time` int(11) NOT NULL,
  `shopid` int(11) NOT NULL,
  `price` int(11) NOT NULL,
  `onsale` int(11) NOT NULL,
  `buycnt` int(11) NOT NULL,
  `position` int(11) NOT NULL DEFAULT '0',
  `saledesc` char(255) NOT NULL DEFAULT '',
  `namepre` char(30) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_soldier_convert` (
  `cid` int(11) NOT NULL,
  `value` int(11) NOT NULL DEFAULT '0',
  `convert` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_technic` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL COMMENT '用户ID',
  `tid` int(11) NOT NULL DEFAULT '0' COMMENT '科技ID',
  `level` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '该科技的级别',
  `cid` int(11) NOT NULL COMMENT '在建的时候是哪个城在建的',
  `state` tinyint(4) NOT NULL DEFAULT '0' COMMENT '科技当前状态\r\n0:正常状态\r\n1:升级中\r\n',
  `state_starttime` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '该科技状态开始时间',
  `state_endtime` int(11) unsigned NOT NULL DEFAULT '0' COMMENT '该科技状态结束时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uid_tid` (`uid`,`tid`)
) ENGINE=MyISAM AUTO_INCREMENT=807 DEFAULT CHARSET=utf8 COMMENT='玩家拥有的所有建筑\r\n';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_thing_position` (
  `thingid` int(11) NOT NULL,
  `cid` int(11) NOT NULL,
  PRIMARY KEY (`thingid`),
  KEY `cid` (`cid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_things` (
  `uid` int(11) NOT NULL,
  `tid` int(11) NOT NULL,
  `count` int(11) NOT NULL DEFAULT '1',
  UNIQUE KEY `uid` (`uid`,`tid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_ticket` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` char(32) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL COMMENT '礼券码',
  `contentid` int(11) NOT NULL COMMENT '礼券内容ID，对应sys_ticket_content表的id',
  `uid` int(11) NOT NULL DEFAULT '0' COMMENT '使用这个礼券的玩家',
  `time` int(11) NOT NULL DEFAULT '0' COMMENT '使用时间',
  `binduid` int(11) NOT NULL DEFAULT '0' COMMENT '礼券绑定的UID',
  `givetime` int(11) NOT NULL DEFAULT '0' COMMENT '礼券码发放时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_code` (`code`),
  KEY `idx_uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_ticket_content` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `content` text NOT NULL COMMENT '礼券内容,gift_cnt,type,id,cnt,type,id,cnt,type,id,cnt.....(type:1道具(id=0表示元宝)、2装备、3任务物品,id表示道具或装备或任务物品的ID，cnt表示个数)',
  `name` char(32) NOT NULL DEFAULT '未命名' COMMENT '礼券组合的名字',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=36 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_trans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sid` int(11) NOT NULL,
  `passtype` char(32) NOT NULL,
  `passport` char(32) NOT NULL,
  `name` char(32) NOT NULL,
  `money` int(11) NOT NULL DEFAULT '0',
  `state` tinyint(4) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_passport` (`passport`,`passtype`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_troop_tactics` (
  `troopid` int(11) NOT NULL,
  `plunder` text CHARACTER SET ascii NOT NULL,
  `invade` text CHARACTER SET ascii NOT NULL,
  `patrol` text CHARACTER SET ascii NOT NULL,
  `field` text CHARACTER SET ascii NOT NULL,
  PRIMARY KEY (`troopid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_troop_things` (
  `uid` int(11) NOT NULL,
  `troop_id` int(11) NOT NULL,
  `thing_id` int(11) NOT NULL,
  `count` int(11) NOT NULL DEFAULT '1',
  UNIQUE KEY `tid` (`troop_id`,`thing_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_troops` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL COMMENT '玩家',
  `cid` int(11) NOT NULL COMMENT '城池',
  `hid` int(11) NOT NULL COMMENT '将领',
  `targetcid` int(11) NOT NULL DEFAULT '0' COMMENT '目标地点',
  `task` tinyint(4) NOT NULL DEFAULT '0',
  `state` smallint(6) NOT NULL DEFAULT '0',
  `starttime` int(11) NOT NULL DEFAULT '0' COMMENT '出发时间',
  `pathtime` int(11) NOT NULL DEFAULT '0',
  `endtime` int(11) NOT NULL DEFAULT '0' COMMENT '结束时间',
  `noback` tinyint(4) NOT NULL DEFAULT '0' COMMENT '中了关门打狗，不能回去',
  `soldiers` char(255) CHARACTER SET ascii NOT NULL DEFAULT '0' COMMENT '士兵，格式为\r\nnum:sid,cnt;sid,cnt....',
  `resource` char(255) CHARACTER SET ascii NOT NULL DEFAULT '0' COMMENT '携带资源 黄金,粮食,木材,石料,铁锭',
  `battleid` int(11) NOT NULL DEFAULT '0' COMMENT '发生战斗时的战斗ＩＤ',
  `people` int(11) NOT NULL DEFAULT '0' COMMENT '军队占用人口数',
  `fooduse` double NOT NULL DEFAULT '0',
  `lastrun` int(11) NOT NULL DEFAULT '0' COMMENT '上一次使用金蝉脱壳的时间',
  `lastlock` int(11) NOT NULL DEFAULT '0' COMMENT '上一次中八门金锁的时间',
  `lastTempt` int(11) NOT NULL DEFAULT '0',
  `lastacc` int(11) NOT NULL DEFAULT '0' COMMENT '上一次千里奔袭的时间',
  `battlefieldid` int(11) NOT NULL DEFAULT '0',
  `startcid` int(11) NOT NULL DEFAULT '0',
  `battleunionid` int(11) NOT NULL DEFAULT '0',
  `targettroopid` int(11) NOT NULL DEFAULT '0',
  `drop` char(100) NOT NULL DEFAULT '',
  `rate` smallint(6) NOT NULL DEFAULT '0',
  `bid` int(11) DEFAULT '0',
  `arrive_time` int(11) DEFAULT '0',
  `ulimit` int(11) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_targetcid` (`targetcid`),
  KEY `idx_cid` (`cid`),
  KEY `idx_uid` (`uid`),
  KEY `idx_battle` (`battlefieldid`),
  KEY `idx_battle_uid` (`uid`,`battlefieldid`),
  KEY `idx_state_cid` (`state`,`cid`)
) ENGINE=MyISAM AUTO_INCREMENT=570 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_union` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(32) NOT NULL DEFAULT '' COMMENT '联盟名称',
  `leader` int(11) NOT NULL DEFAULT '0' COMMENT '盟主UID',
  `creator` int(11) NOT NULL,
  `member` int(11) NOT NULL DEFAULT '1' COMMENT '成员数',
  `rank` int(11) NOT NULL DEFAULT '0' COMMENT '排名',
  `prestige` int(11) NOT NULL DEFAULT '0' COMMENT '联盟声望',
  `intro` text NOT NULL COMMENT '联盟介绍',
  `announcement` text NOT NULL COMMENT '联盟公告',
  `chieforder` tinyint(4) NOT NULL DEFAULT '0',
  `createtime` int(11) NOT NULL DEFAULT '0' COMMENT '建立时间',
  `actmoney` int(11) DEFAULT '0' COMMENT '联盟活动期间总充值',
  `sns_flag` int(11) NOT NULL DEFAULT '0' COMMENT 'SNS平台推送标志',
  `donate` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_union_apply` (
  `uid` int(11) NOT NULL,
  `unionid` int(11) NOT NULL,
  `name` char(32) NOT NULL,
  `time` int(11) NOT NULL,
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_union_building` (
  `unionid` int(11) NOT NULL DEFAULT '0',
  `bid` int(11) NOT NULL DEFAULT '0',
  `level` int(11) NOT NULL DEFAULT '0',
  `curnum` int(11) NOT NULL DEFAULT '0',
  UNIQUE KEY `idx_unionid_bid` (`unionid`,`bid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_union_city` (
  `unionid` int(11) NOT NULL,
  `count` smallint(6) NOT NULL,
  PRIMARY KEY (`unionid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_union_event` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `unionid` int(11) NOT NULL COMMENT '盟联ID',
  `type` tinyint(4) NOT NULL COMMENT '事件类型\r\n０加入联盟\r\n１退出联盟\r\n２开除成员\r\n３转让盟主\r\n４联盟改名\r\n５友好关系\r\n６中立关系\r\n７敌对关系\r\n８宣战\r\n９权限更改\r\n１０辞职',
  `content` char(255) NOT NULL DEFAULT '' COMMENT '事件描述',
  `evttime` int(11) NOT NULL DEFAULT '0' COMMENT '发生时间',
  PRIMARY KEY (`id`),
  KEY `unionid` (`unionid`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_union_invite` (
  `unionid` int(11) NOT NULL,
  `inviter` char(32) NOT NULL COMMENT '发出邀请的联盟官员',
  `uid` int(11) NOT NULL,
  `time` int(11) NOT NULL DEFAULT '0',
  UNIQUE KEY `union_uid` (`unionid`,`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_union_mark` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `unionid` int(11) NOT NULL COMMENT '联盟id',
  `cid` int(11) NOT NULL COMMENT 'cid',
  `wid` int(11) NOT NULL COMMENT 'wid',
  `endtime` int(11) NOT NULL COMMENT '结束时间',
  `type` int(11) NOT NULL DEFAULT '0' COMMENT '标记类型',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_union_relation` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` tinyint(4) NOT NULL COMMENT '关系：0：友好，1：中立，2：敌对',
  `unionid` int(11) NOT NULL COMMENT '己方联盟',
  `target` int(11) NOT NULL COMMENT '目标联盟',
  `time` int(11) NOT NULL DEFAULT '0' COMMENT '上次关系建立时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_u_t` (`unionid`,`target`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_union_report` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` tinyint(4) NOT NULL DEFAULT '1' COMMENT '1：进攻，2：防御',
  `unionid` int(11) NOT NULL DEFAULT '0' COMMENT '己方联盟',
  `enemy` char(32) NOT NULL DEFAULT '－－' COMMENT '对方联盟',
  `origincid` int(11) NOT NULL DEFAULT '0',
  `origincity` char(32) NOT NULL DEFAULT '－－',
  `happencid` int(11) NOT NULL DEFAULT '0',
  `happencity` char(32) NOT NULL DEFAULT '－－',
  `time` int(11) NOT NULL DEFAULT '0' COMMENT '发生时间',
  `description` char(255) NOT NULL DEFAULT '',
  `content` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `unionid` (`unionid`)
) ENGINE=MyISAM AUTO_INCREMENT=23 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_union_reward` (
  `rank` int(11) NOT NULL,
  `unionid` int(11) NOT NULL DEFAULT '0',
  `uid` int(11) NOT NULL DEFAULT '0',
  `pos` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL DEFAULT '0',
  KEY `idx_uid_unionid` (`uid`,`unionid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user` (
  `uid` int(11) NOT NULL AUTO_INCREMENT,
  `name` char(32) NOT NULL DEFAULT '',
  `passtype` char(32) NOT NULL DEFAULT '' COMMENT '通行证类型',
  `passport` char(64) NOT NULL,
  `state` tinyint(4) NOT NULL DEFAULT '0' COMMENT '状态\r\n0：正常玩家\r\n1：新手玩家\r\n2：免战玩家\r\n3：刚注册没有建新城及玩家名\r\n4：被人打完了需要重新建新城\r\n5：锁定，不能登录',
  `bak_state` tinyint(4) NOT NULL DEFAULT '0',
  `group` tinyint(4) NOT NULL DEFAULT '4' COMMENT '玩家组\r\n0：一般玩家;\r\n1：GM;\r\n2：NPC;',
  `sex` tinyint(4) NOT NULL DEFAULT '0',
  `face` smallint(4) NOT NULL DEFAULT '0',
  `prestige` double(11,0) NOT NULL DEFAULT '0' COMMENT '声望',
  `warprestige` double(11,0) NOT NULL DEFAULT '0' COMMENT '战争获得的声望',
  `money` int(11) NOT NULL DEFAULT '0' COMMENT '元宝数',
  `rank` int(11) NOT NULL DEFAULT '0' COMMENT '排名',
  `lastcid` int(11) NOT NULL DEFAULT '0',
  `union_id` int(11) NOT NULL DEFAULT '0',
  `union_pos` tinyint(4) NOT NULL DEFAULT '0' COMMENT '０表示普通成员，１表示盟主，２表示副盟主，３表示长老，４表示官员',
  `nobility` tinyint(4) NOT NULL DEFAULT '0',
  `officepos` tinyint(4) NOT NULL DEFAULT '0',
  `flagchar` char(10) NOT NULL DEFAULT '',
  `regtime` int(11) NOT NULL,
  `domainid` int(11) NOT NULL DEFAULT '0',
  `war_attack_prestige` int(11) NOT NULL DEFAULT '0',
  `war_defence_prestige` int(11) NOT NULL DEFAULT '0',
  `gift` int(11) NOT NULL DEFAULT '0',
  `last_pay` tinyint(4) NOT NULL DEFAULT '0',
  `honour` int(11) NOT NULL,
  `armor_column` int(11) DEFAULT '50',
  `achivement_count` int(11) DEFAULT '0',
  `achivement_point` int(11) DEFAULT '0',
  PRIMARY KEY (`uid`),
  KEY `union_id` (`union_id`),
  KEY `name` (`name`),
  KEY `passport` (`passport`)
) ENGINE=MyISAM AUTO_INCREMENT=1003 DEFAULT CHARSET=utf8 COMMENT='玩家数据表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_achivement` (
  `uid` int(11) NOT NULL,
  `achivement_id` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL DEFAULT '0',
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_act` (
  `id` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  `con` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL DEFAULT '0'
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_action_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `action` int(11) NOT NULL DEFAULT '0',
  `count` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL DEFAULT '0',
  `mark` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `uid` (`uid`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_armor` (
  `sid` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `armorid` int(11) NOT NULL COMMENT '装备ID',
  `hp` smallint(6) NOT NULL DEFAULT '0' COMMENT '装备耐久度',
  `hp_max` smallint(6) NOT NULL DEFAULT '0' COMMENT '备装当前最大耐久度',
  `hid` int(11) NOT NULL DEFAULT '0' COMMENT '目前在使用该装备的将领，０表示装备无人使用',
  `strong_level` int(11) DEFAULT '0',
  `strong_value` int(11) DEFAULT '0',
  `embed_pearls` varchar(255) DEFAULT '',
  `embed_holes` varchar(255) DEFAULT '' COMMENT '0:打开, 1:需要一级打孔器, 2:需要2级打孔器 3:不开的',
  `deified` varchar(255) DEFAULT NULL,
  `active_special` tinyint(4) NOT NULL DEFAULT '0',
  `strong_times` tinyint(4) DEFAULT '0',
  `combine_level` int(11) NOT NULL DEFAULT '0',
  `best_quality` varchar(30) DEFAULT NULL COMMENT '装备拥有的极品属性a,b,c   a参照cfg_xilian id，b是属性，c是增加值',
  PRIMARY KEY (`sid`),
  KEY `idx_uid_aid` (`uid`,`armorid`),
  KEY `idx_hid` (`hid`)
) ENGINE=MyISAM AUTO_INCREMENT=38940 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_armor_trade` (
  `uid` int(11) NOT NULL,
  `sid` int(11) NOT NULL DEFAULT '0',
  `armorid` int(11) NOT NULL DEFAULT '0',
  `price` int(11) NOT NULL DEFAULT '0',
  `trade` int(11) NOT NULL DEFAULT '0',
  `strong_level` int(11) NOT NULL DEFAULT '0',
  `strong_times` int(11) NOT NULL DEFAULT '0',
  `strong_value` int(11) NOT NULL DEFAULT '0',
  `combine_level` int(11) NOT NULL DEFAULT '0',
  `best_quality` int(11) NOT NULL DEFAULT '0',
  `embed_holes` int(11) NOT NULL DEFAULT '0',
  `embed_pearls` int(11) NOT NULL DEFAULT '0',
  `hp` int(11) NOT NULL DEFAULT '0',
  `hp_max` int(11) NOT NULL DEFAULT '0',
  `active_special` int(11) NOT NULL DEFAULT '0',
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_assemble` (
  `uid` int(11) NOT NULL DEFAULT '0',
  `rank` int(11) NOT NULL DEFAULT '0' COMMENT '当前排名',
  `count` int(11) NOT NULL DEFAULT '0' COMMENT '今日已挑战次数',
  `maxrank` int(11) NOT NULL DEFAULT '0' COMMENT '历史最高排名',
  `maxwin` int(11) NOT NULL DEFAULT '0' COMMENT '最高连胜记录',
  `next_challenge_time` int(11) NOT NULL DEFAULT '0' COMMENT '下一次可挑战时间',
  `next_refresh_time` int(11) NOT NULL DEFAULT '0' COMMENT '下一次可刷新时间',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_battle_event` (
  `uid` int(11) NOT NULL,
  `eventid` int(11) NOT NULL DEFAULT '0',
  `battlefieldid` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_battle_field` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bid` int(11) NOT NULL DEFAULT '1' COMMENT '战场id',
  `createuid` int(11) NOT NULL,
  `level` smallint(6) NOT NULL,
  `maxpeople` smallint(6) NOT NULL DEFAULT '5',
  `state` tinyint(3) NOT NULL DEFAULT '0' COMMENT '0:正常开启 1:冻结 2:准备 3:关闭',
  `starttime` int(11) NOT NULL DEFAULT '0',
  `endtime` int(11) NOT NULL DEFAULT '0',
  `finishtime` int(11) NOT NULL DEFAULT '0',
  `type` smallint(4) NOT NULL,
  `minpeople` smallint(5) unsigned DEFAULT '1',
  `winner` smallint(6) DEFAULT '-1',
  `progress` smallint(6) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `state_time` (`state`,`endtime`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_battle_state` (
  `uid` int(11) NOT NULL,
  `battlefieldid` int(11) NOT NULL,
  `honour` int(11) NOT NULL DEFAULT '0',
  `bid` int(11) NOT NULL,
  `unionid` int(11) NOT NULL DEFAULT '1',
  `startcid` int(11) DEFAULT '0',
  `level` int(11) NOT NULL,
  `jointime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '加入时间',
  `sent_troop_count` int(11) DEFAULT '0',
  `state` int(11) DEFAULT '0',
  `in_cross_battle` tinyint(4) DEFAULT '0',
  `in_battle_hids` varchar(255) DEFAULT '-1',
  PRIMARY KEY (`uid`,`battlefieldid`),
  KEY `idx_bid_unionid` (`battlefieldid`,`unionid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_book` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `bid` int(10) NOT NULL,
  `uid` int(10) NOT NULL,
  `hid` int(10) NOT NULL DEFAULT '0',
  `level` int(10) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_bookshelfnum` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `uid` int(10) NOT NULL DEFAULT '0',
  `num` int(10) NOT NULL DEFAULT '0' COMMENT '玩家拥有技能书格子的数量',
  PRIMARY KEY (`uid`),
  KEY `id` (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_chibi_achivement` (
  `uid` int(11) NOT NULL DEFAULT '0',
  `gongxun` int(11) DEFAULT '0' COMMENT '家玩在赤壁中获得的功勋',
  `win` int(11) DEFAULT '0' COMMENT '玩家在赤壁胜利的次数',
  `monster` int(11) DEFAULT '0' COMMENT '家玩消灭的野怪次数',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_chibi_state` (
  `uid` int(11) NOT NULL,
  `battlefieldid` int(11) NOT NULL,
  `honour` int(11) NOT NULL DEFAULT '0',
  `bid` int(11) NOT NULL,
  `unionid` int(11) NOT NULL DEFAULT '1',
  `startcid` int(11) DEFAULT '0',
  `level` int(11) NOT NULL,
  `jointime` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '加入时间',
  `sent_troop_count` int(11) DEFAULT '0',
  `state` int(11) DEFAULT '0',
  `in_cross_battle` tinyint(4) DEFAULT '0',
  `in_battle_hids` varchar(255) DEFAULT '-1',
  PRIMARY KEY (`uid`,`battlefieldid`),
  KEY `idx_bid_unionid` (`battlefieldid`,`unionid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_child` (
  `hid` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `name` char(16) NOT NULL DEFAULT '' COMMENT '名字',
  `sex` tinyint(4) NOT NULL DEFAULT '0',
  `face` smallint(6) NOT NULL DEFAULT '0',
  `command_base` smallint(6) NOT NULL DEFAULT '0' COMMENT '领将的统率',
  `affairs_base` smallint(6) NOT NULL DEFAULT '0' COMMENT '内政',
  `bravery_base` smallint(6) NOT NULL DEFAULT '0' COMMENT '勇武',
  `wisdom_base` smallint(6) NOT NULL DEFAULT '0' COMMENT '智谋',
  `command_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '统率培养值',
  `affairs_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '内政培养值',
  `bravery_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '勇武培养值',
  `wisdom_add` smallint(6) NOT NULL DEFAULT '0' COMMENT '智谋培养值',
  `qixin_multip` int(11) NOT NULL DEFAULT '0' COMMENT '七星早产儿属性加成',
  `wenpo_multip` int(11) NOT NULL DEFAULT '0' COMMENT '七星早产儿属性加成',
  `upgrade_value` int(11) NOT NULL DEFAULT '0' COMMENT '成长值',
  `is_change` smallint(6) NOT NULL DEFAULT '0' COMMENT '0：未改名，1：已经改名',
  `out_hid` int(11) NOT NULL DEFAULT '0' COMMENT '转化成将领的hid',
  PRIMARY KEY (`hid`),
  UNIQUE KEY `idx_uid_hid` (`uid`,`hid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='玩家孩子数据表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_comming` (
  `uid` int(11) NOT NULL,
  `site_id` int(11) NOT NULL,
  `page_id` char(32) NOT NULL,
  `sub_page_id` varchar(255) NOT NULL,
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='记录进入过该服务器的用户的来源信息';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_designation` (
  `id` int(10) NOT NULL AUTO_INCREMENT,
  `did` int(10) NOT NULL,
  `uid` int(10) NOT NULL,
  `ison` int(10) NOT NULL DEFAULT '0' COMMENT '0:未穿戴\r\n1:穿戴',
  `state` int(10) NOT NULL DEFAULT '2' COMMENT '0:失去称号\r\n1:拥有称号\r\n2:获得称号',
  PRIMARY KEY (`id`),
  KEY `idx_uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_donate` (
  `uid` int(11) NOT NULL DEFAULT '0',
  `unionid` int(11) NOT NULL DEFAULT '0',
  `donate` int(11) NOT NULL DEFAULT '0',
  `curnum` int(11) NOT NULL DEFAULT '0',
  `duihuan` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL DEFAULT '0',
  UNIQUE KEY `idx_uid_unionid` (`uid`,`unionid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_expr_reward` (
  `uid` int(11) NOT NULL,
  `rewardid` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  UNIQUE KEY `uid_rewardid` (`uid`,`rewardid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_fcm` (
  `uid` int(11) NOT NULL DEFAULT '0',
  `cardid` varchar(255) NOT NULL DEFAULT '0',
  `onlinetime` int(11) NOT NULL DEFAULT '0',
  `lastupdate` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`),
  KEY `idx_cardid` (`cardid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_forbidden` (
  `uid` int(11) NOT NULL COMMENT '户用UID',
  `chat` int(11) NOT NULL DEFAULT '0' COMMENT '聊天禁言结束时间',
  `login` int(11) NOT NULL COMMENT '帐号冻结结束时间',
  `reason` char(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_goal` (
  `uid` int(11) NOT NULL,
  `gid` int(11) NOT NULL,
  `currentcount` int(11) NOT NULL DEFAULT '0',
  UNIQUE KEY `uid_gid` (`uid`,`gid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_guide` (
  `uid` int(11) NOT NULL,
  `gid` int(11) NOT NULL,
  `state` tinyint(4) NOT NULL DEFAULT '1' COMMENT '完成状态\r\n0：未完成 1：已完成',
  `time` int(11) DEFAULT '0',
  UNIQUE KEY `uid_gid` (`uid`,`gid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='引导完成状态\n';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_level` (
  `uid` int(11) NOT NULL DEFAULT '0',
  `level` int(11) NOT NULL DEFAULT '0',
  `time` int(11) DEFAULT NULL,
  `getrewardtime` int(11) DEFAULT NULL,
  `count` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_login_reward` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `rewardtype` tinyint(4) NOT NULL DEFAULT '0' COMMENT '每日奖励类型',
  `date` varchar(10) DEFAULT NULL COMMENT '奖励生成日期',
  `time` int(11) DEFAULT NULL COMMENT '奖励生成时间',
  `gettime` int(11) DEFAULT '0' COMMENT '奖励领取时间',
  `boxdetail_id` int(11) NOT NULL DEFAULT '0',
  `goal_id` smallint(6) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `uid_date` (`uid`,`date`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='用户登陆奖励\n';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_luoyang` (
  `uid` int(11) NOT NULL,
  `unionid` int(11) NOT NULL,
  `score` int(11) NOT NULL,
  `second` int(11) NOT NULL,
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_marry` (
  `uid` int(11) NOT NULL,
  `roomcount` int(11) NOT NULL DEFAULT '1' COMMENT '玩家拥有房间的数量',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='玩家亲子系统相关的数据表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_online` (
  `uid` int(11) NOT NULL DEFAULT '0' COMMENT '1 成人',
  `login_time` int(11) DEFAULT '0',
  `logout_time` int(11) DEFAULT '0',
  `online_time` int(11) DEFAULT '0',
  `offline_time` int(11) DEFAULT '0',
  `state` int(11) DEFAULT '0',
  PRIMARY KEY (`uid`),
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_password` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(10) NOT NULL,
  `time` int(11) NOT NULL COMMENT '玩家修改二级密码的时间',
  `password` char(64) NOT NULL DEFAULT '' COMMENT '二级密码',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_relation` (
  `time` int(11) NOT NULL,
  `tuid` int(11) NOT NULL,
  `uid` int(11) NOT NULL,
  `type` int(11) NOT NULL DEFAULT '0' COMMENT '关系类型,0:好友 ,1仇人 ',
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cid` int(11) NOT NULL,
  `tcid` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `t_u_t_index` (`tuid`,`uid`,`type`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_reward_task` (
  `uid` int(11) NOT NULL,
  `tid` int(11) NOT NULL,
  `state` tinyint(4) NOT NULL DEFAULT '1',
  `type` tinyint(4) NOT NULL DEFAULT '0',
  `targetcid` int(11) NOT NULL,
  `goal` int(11) NOT NULL,
  UNIQUE KEY `uid_tid` (`uid`,`tid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_sign` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(10) NOT NULL,
  `time` int(11) NOT NULL,
  `state` tinyint(4) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_state` (
  `uid` int(11) NOT NULL,
  `forbistart` int(11) NOT NULL DEFAULT '0' COMMENT '封禁开始时间',
  `forbiend` int(11) NOT NULL DEFAULT '0' COMMENT '封禁结束时间',
  `vacstart` int(11) NOT NULL DEFAULT '0' COMMENT '休假开始时间',
  `vacend` int(11) NOT NULL DEFAULT '0' COMMENT '休闲结束时间',
  `reason` text NOT NULL,
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_sys_task` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `tid` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_tactics` (
  `uid` int(11) NOT NULL,
  `plunder` text CHARACTER SET ascii NOT NULL,
  `invade` text CHARACTER SET ascii NOT NULL,
  `field` text CHARACTER SET ascii NOT NULL,
  `patrol` text CHARACTER SET ascii NOT NULL,
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_task` (
  `uid` int(11) NOT NULL,
  `tid` int(11) NOT NULL,
  `state` tinyint(4) NOT NULL DEFAULT '1',
  UNIQUE KEY `uid_tid` (`uid`,`tid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_task_num` (
  `uid` int(11) NOT NULL,
  `type` int(11) NOT NULL DEFAULT '1' COMMENT '1,君主将任务',
  `num` int(11) NOT NULL DEFAULT '0',
  `maxnum` int(11) NOT NULL DEFAULT '10',
  PRIMARY KEY (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_taskstate` (
  `uid` int(11) NOT NULL,
  `tid` int(11) NOT NULL DEFAULT '0',
  `starttime` int(11) NOT NULL DEFAULT '0',
  `endtime` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`,`tid`),
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_tie_deify_attribute` (
  `attid` int(11) NOT NULL COMMENT '属性id',
  `sid` int(11) NOT NULL COMMENT '装备id',
  `value` int(11) NOT NULL COMMENT '属性值',
  UNIQUE KEY `idx_sid_attid` (`sid`,`attid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_troopscheme` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL COMMENT '玩家',
  `type` int(11) NOT NULL COMMENT '方案类型，1：方案1、2：方案2',
  `soldiers` char(255) CHARACTER SET ascii NOT NULL DEFAULT '0' COMMENT '士兵，格式为\r\nnum:sid,cnt;sid,cnt....',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sys_user_workshop` (
  `id` int(6) NOT NULL AUTO_INCREMENT,
  `uid` int(6) NOT NULL,
  `gidStr` varchar(99) DEFAULT NULL,
  `time` int(15) DEFAULT NULL,
  `count` int(10) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `temp_act_event` (
  `uid` int(11) NOT NULL,
  `type` int(11) DEFAULT NULL COMMENT '活动事件类型 1001是临时事件',
  `eid` int(11) DEFAULT NULL COMMENT '活动事件ID 1002是杀死张角',
  `count` int(11) NOT NULL DEFAULT '0',
  UNIQUE KEY `uid_type_eid` (`uid`,`type`,`eid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `test_cheat` (
  `uid` int(11) NOT NULL,
  `money` int(11) NOT NULL DEFAULT '0',
  `time` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`),
  KEY `uid` (`uid`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `test_code` (
  `passport` varchar(255) NOT NULL DEFAULT '',
  KEY `passport` (`passport`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `test_passport` (
  `pid` int(11) NOT NULL AUTO_INCREMENT,
  `passport` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `password` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  PRIMARY KEY (`pid`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tmp_bak_hero` (
  `hid` int(11) NOT NULL DEFAULT '0' COMMENT '英雄ID',
  `uid` int(11) NOT NULL COMMENT '归属哪个玩家，如果是NPC的话，为0',
  `name` char(16) CHARACTER SET utf8 NOT NULL DEFAULT '' COMMENT '名字',
  `npcid` smallint(6) NOT NULL DEFAULT '0',
  `sex` tinyint(4) NOT NULL,
  `face` smallint(6) NOT NULL,
  `cid` int(11) NOT NULL COMMENT '所属城池',
  `state` tinyint(4) NOT NULL DEFAULT '0' COMMENT '状态：0，空闲；1,城守；2,出征，3,战斗,4，驻守,5,俘虏',
  `level` smallint(6) NOT NULL DEFAULT '1' COMMENT '级别',
  `exp` int(11) NOT NULL DEFAULT '0' COMMENT '经验值',
  `command_base` smallint(6) NOT NULL DEFAULT '0' COMMENT '领将的统率',
  `command_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '率统加成',
  `affairs_base` smallint(6) NOT NULL DEFAULT '0' COMMENT '内政',
  `bravery_base` smallint(6) NOT NULL DEFAULT '0' COMMENT '勇武',
  `wisdom_base` smallint(6) NOT NULL DEFAULT '0' COMMENT '智谋',
  `affairs_add` smallint(6) NOT NULL DEFAULT '0',
  `bravery_add` smallint(6) NOT NULL DEFAULT '0',
  `wisdom_add` smallint(6) NOT NULL DEFAULT '0',
  `affairs_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '政内加成',
  `bravery_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '勇武加成',
  `wisdom_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '智谋加成',
  `force_max_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '体力加成',
  `energy_max_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '精力加成',
  `speed_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '速度加成',
  `attack_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '攻击加成',
  `defence_add_on` smallint(6) NOT NULL DEFAULT '0' COMMENT '防御加成',
  `loyalty` smallint(6) NOT NULL DEFAULT '0' COMMENT '忠诚',
  `herotype` smallint(6) NOT NULL DEFAULT '0' COMMENT '将领类型,0普通武将，1黄巾活动武将,2聚贤包开出武将,3-9圣诞武将',
  `hero_health` tinyint(4) NOT NULL DEFAULT '0' COMMENT '状态：0，健康；1，重伤；2，修养'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tmp_bak_membattle` (
  `id` int(11) NOT NULL DEFAULT '0',
  `type` int(11) NOT NULL DEFAULT '0',
  `round` int(11) NOT NULL DEFAULT '0',
  `attackcid` int(11) NOT NULL DEFAULT '0',
  `attackhid` int(11) NOT NULL DEFAULT '0',
  `attacksoldiers` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `attackpos` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `attackadd` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `resistcid` int(11) NOT NULL DEFAULT '0',
  `resisthid` int(11) NOT NULL DEFAULT '0',
  `resistsoldiers` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `resistpos` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `resistadd` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `resistdefence` char(255) CHARACTER SET ascii NOT NULL DEFAULT '',
  `wallhp` int(11) NOT NULL DEFAULT '0',
  `walllevel` int(11) NOT NULL DEFAULT '0',
  `fieldrange` int(11) NOT NULL DEFAULT '0',
  `nexttime` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  `level` int(11) NOT NULL DEFAULT '0',
  `attackstartcid` int(11) NOT NULL DEFAULT '0',
  `resiststartcid` int(11) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tmp_bak_sysbattle` (
  `id` int(11) NOT NULL DEFAULT '0',
  `cid` int(11) NOT NULL,
  `type` int(11) NOT NULL DEFAULT '0',
  `state` int(11) NOT NULL DEFAULT '0',
  `result` int(11) NOT NULL DEFAULT '0',
  `attackuid` int(11) NOT NULL DEFAULT '0',
  `resistuid` int(11) NOT NULL DEFAULT '0',
  `attacktroop` int(11) NOT NULL DEFAULT '0',
  `resisttroops` int(11) NOT NULL DEFAULT '0',
  `resistdefence` int(11) NOT NULL DEFAULT '0',
  `starttime` int(11) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tmp_user_password` (
  `passport` varchar(30) NOT NULL,
  `password` varchar(40) CHARACTER SET ascii NOT NULL DEFAULT '',
  `auth` varchar(100) NOT NULL DEFAULT '',
  PRIMARY KEY (`passport`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
