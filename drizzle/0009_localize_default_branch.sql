UPDATE `team`
SET
	`name` = CASE
		WHEN (SELECT `locale` FROM `organization` WHERE `organization`.`id` = `team`.`organization_id`) = 'es'
			THEN 'Sede Principal'
		ELSE 'Main Branch'
	END,
	`updated_at` = cast(unixepoch('subsecond') * 1000 as integer)
WHERE `name` = 'Main'
	AND (SELECT count(*) FROM `team` AS `company_team` WHERE `company_team`.`organization_id` = `team`.`organization_id`) = 1;
