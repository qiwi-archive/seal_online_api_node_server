import {Pool as IPool} from 'pg-pool';
import {PgService} from "innots";
import * as config from 'config';

/**
 * NOTE: Декларация pg-pool и его имплементация немного различаются (видимо баг), поэтому подключим через require.
 */
// TODO Пока не реализован глобальный контекст/иной вариант переиспользования пула - создаем его в рамках модели
/* tslint:disable */
const Pool = require('pg-pool');
//workaround for int8 timestamp ms
require('pg').types.setTypeParser(20, function(val) {
    return parseInt(val);
});
/* tslint:enable */

const pool: IPool = new Pool(config.get('db'));
const pgService = new PgService(pool);
export interface ITagStatus {
    idTag: number;
    tagName: string;
    tagDescription: string;
    tagCode: string;
    tagOrder: number;
    losingSum: number;
    lastDayCasesCount: number;
    lastDayCasesAmount: number;
};

export interface IChartData {
    addDate: number;
    allCount: number;
    statAllCount: number;
    normalizedStatAllCount: number;
    allCountHighRange: number;
    allCountLowRange: number;
    allAmount: number;
    paidCount: number;
    paidAmount: number;
    conversion: number;
    statConversion: number;
    conversionHighRange: number;
    conversionLowRange: number;
    paymentsCount: number;
    statPaymentsCount: number;
    normalizedStatPaymentsCount: number;
    paymentsCountHighRange: number;
    paymentsCountLowRange: number;
    paymentsAmount: number;
    health: number;
    statHealth: number;
    avgPaySeconds: number;
    hasCase: number;
};

export class MonitoringModel {
    public static readonly getStatusSelect: string = `
    SELECT
			spr_tags.id_tag,
			spr_tags.tag_name,
			spr_tags.tag_description,
			spr_tags.tag_code,
			spr_tags.tag_order,
			ROUND(COALESCE(losing_sums.lost_sum, 0))::integer AS losing_sum,
			COALESCE (last_day_cases.last_day_cases_count, 0) AS last_day_cases_count,
			ROUND(COALESCE(last_day_cases.last_day_cases_amount, 0))::integer AS last_day_cases_amount
		FROM spr_tags
		LEFT JOIN (
			SELECT
				id_tag,
				SUM(case_lost_amount) AS lost_sum,
				max(case_end_timestamp) as last_case_timestamp
			FROM obj_case_tag
			WHERE   case_end_timestamp >= now() - interval '20 minutes'
				AND obj_case_tag.case_parent_id IS NULL
			GROUP BY id_tag
			) AS losing_sums
			ON losing_sums.id_tag = spr_tags.id_tag
			AND losing_sums.last_case_timestamp >= now() - interval '15 minutes'
		LEFT JOIN (
			SELECT
				id_tag,
				COUNT (id_case) AS last_day_cases_count,
				SUM (case_lost_amount) AS last_day_cases_amount
			FROM obj_case_tag
			WHERE
				obj_case_tag.case_status = 'W'
				AND obj_case_tag.case_end_timestamp >= now() - interval '12 hours'
				AND obj_case_tag.case_parent_id IS NULL
			GROUP BY id_tag
		) AS last_day_cases ON last_day_cases.id_tag = spr_tags.id_tag
		WHERE spr_tags.tag_monitoring_enabled = true
		ORDER BY losing_sum, tag_order
`;

    public static readonly getChartDataSelect: string = `
 WITH max_timestamps AS (
     SELECT id_tag, max(bills_add_timestamp) AS max_bills_add_timestamp
     FROM aggr_bills_tags
     WHERE aggr_bills_tags.bills_add_timestamp > now() - INTERVAL '1 hour'
     GROUP BY id_tag
 ) 
 SELECT
	(EXTRACT(epoch FROM normalized_stat_bills_tag.sbills_add_timestamp)::INT8 * 1000)::INT8 AS add_date,
	aggr_bills_tags.bills_count all_count,
	stat_bills_tag.sbills_all_count stat_all_count,
	normalized_stat_bills_tag.sbills_all_count normalized_stat_all_count,
	normalized_stat_bills_tag.sbills_all_count::float * (100 + bills_count_coeff)::float / 100 all_count_high_range,
	CASE WHEN 
	normalized_stat_bills_tag.sbills_add_timestamp BETWEEN max_bills_add_timestamp AND max_bills_add_timestamp + INTERVAL '15 minutes'
	THEN normalized_stat_bills_tag.sbills_all_count::float * (100 - 3 * bills_count_coeff)::float / 100
	ELSE normalized_stat_bills_tag.sbills_all_count::float * (100 - bills_count_coeff)::float / 100
	END AS all_count_low_range,
	aggr_bills_tags.bills_amount all_amount,
	aggr_bills_tags.bills_paid_count paid_count,
	aggr_bills_tags.bills_paid_amount paid_amount,
	(CASE
		WHEN aggr_bills_tags.bills_count = 0 THEN 0
		ELSE aggr_bills_tags.bills_paid_count::NUMERIC / aggr_bills_tags.bills_count::NUMERIC * 100
	END)::float AS conversion,
	stat_bills_tag.sbills_conversion stat_conversion,
	normalized_stat_bills_tag.sbills_conversion::float 
	    * (100 + bills_conversion_coeff)::float / 100 conversion_high_range,
	CASE WHEN 
	normalized_stat_bills_tag.sbills_add_timestamp BETWEEN max_bills_add_timestamp AND max_bills_add_timestamp + INTERVAL '15 minutes'
	THEN normalized_stat_bills_tag.sbills_conversion::float * (100 - 3 * bills_conversion_coeff)::float / 100
	ELSE normalized_stat_bills_tag.sbills_conversion::float * (100 - bills_conversion_coeff)::float / 100
	END AS conversion_low_range,
	aggr_bills_tags.bills_payments_count payments_count,
	stat_bills_tag.sbills_payments_count stat_payments_count,
	normalized_stat_bills_tag.sbills_payments_count normalized_stat_payments_count,
	normalized_stat_bills_tag.sbills_payments_count::float 
	    * (100 + bills_payments_coeff)::float / 100 payments_count_high_range,
	normalized_stat_bills_tag.sbills_payments_count::float 
	    * (100 - bills_payments_coeff)::float / 100 payments_count_low_range,
	aggr_bills_tags.bills_payments_amount payments_amount,
	(CASE
		WHEN aggr_bills_tags.bills_count = 0 THEN 0
		ELSE ROUND( aggr_bills_tags.bills_payments_count::NUMERIC / aggr_bills_tags.bills_count::NUMERIC * 100 )
	END)::float AS health,
	stat_bills_tag.sbills_health stat_health,
	CASE
		WHEN aggr_bills_tags.bills_paid_count = 0 THEN 0
		ELSE ROUND( aggr_bills_tags.bills_pay_seconds::NUMERIC / aggr_bills_tags.bills_paid_count::NUMERIC )
	END AS avg_pay_seconds,
	CASE WHEN obj_case_tag.id_case IS NOT NULL THEN 1 ELSE 0 END AS has_case
	FROM
	normalized_stat_bills_tag
	INNER JOIN stat_bills_tag
	ON stat_bills_tag.id_tag = normalized_stat_bills_tag.id_tag 
	    AND stat_bills_tag.sbills_add_timestamp = normalized_stat_bills_tag.sbills_add_timestamp
	INNER JOIN v_stat_bills_accuracy_rates 
	ON v_stat_bills_accuracy_rates.id_tag = normalized_stat_bills_tag.id_tag 
	    AND v_stat_bills_accuracy_rates.add_section = normalized_stat_bills_tag.sbills_add_section
	LEFT JOIN aggr_bills_tags 
	ON normalized_stat_bills_tag.id_tag = aggr_bills_tags.id_tag 
	    AND normalized_stat_bills_tag.sbills_add_timestamp = aggr_bills_tags.bills_add_timestamp
	LEFT JOIN max_timestamps ON max_timestamps.id_tag = normalized_stat_bills_tag.id_tag
	LEFT JOIN obj_case_tag 
	ON obj_case_tag.id_tag = normalized_stat_bills_tag.id_tag 
	AND normalized_stat_bills_tag.sbills_add_timestamp BETWEEN obj_case_tag.case_start_timestamp AND obj_case_tag.case_end_timestamp 
	AND obj_case_tag.case_parent_id IS NULL
	WHERE
		normalized_stat_bills_tag.id_tag = $1
		AND normalized_stat_bills_tag.sbills_add_timestamp BETWEEN $2::timestamp AND $3::timestamp
	ORDER BY normalized_stat_bills_tag.sbills_add_timestamp;
`;

    public async getStatus(): Promise<Array<ITagStatus>> {
        return await pgService.getRows(MonitoringModel.getStatusSelect, []);
    }

    public async getChartData(idTag: number, dateStart: string, dateEnd: string): Promise<Array<IChartData>> {
        return await pgService.getRows(MonitoringModel.getChartDataSelect, [idTag, dateStart, dateEnd]);
    }
}