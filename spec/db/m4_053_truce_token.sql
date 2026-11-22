-- R4-S3: 免战牌道具。
INSERT INTO cfg_item(item_cfg_id,code,name,item_type,max_stack,meta)
VALUES(2050,'truce_token','免战牌',1,99,'{"description":"使用后城池免战 8 小时。"}')
ON CONFLICT (item_cfg_id) DO UPDATE SET code=EXCLUDED.code,name=EXCLUDED.name,item_type=EXCLUDED.item_type,max_stack=EXCLUDED.max_stack,meta=EXCLUDED.meta;
