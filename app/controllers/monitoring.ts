import {Context} from 'koa';
import {Controller} from 'innots';
import {MonitoringModel} from '../models/monitoring';

const monitoringModel = new MonitoringModel();

export class MonitoringController extends Controller {
    getStatus = async(ctx: Context, next: Function): Promise<void> => {
        ctx.body = await monitoringModel.getStatus();
        next();
    };
    getChartData = async(ctx: Context, next: Function): Promise<void> => {
        const data = this.validate(ctx, (validator) => {
            return {
                idTag: validator.isInt('id_tag'),
                dateStart: validator.optional.isString('date_start', -1),
                dateEnd: validator.optional.isString('date_end', -1)
            };
        });
        if (!data.dateStart || !data.dateEnd) {
            let date = new Date();
            // Приседания с таймзонами из-за toISOString
            let tzoffset = date.getTimezoneOffset() * 60000;
            date.setTime(date.getTime() - tzoffset);
            if (!data.dateEnd) {
                // Текущая дата плюс час
                data.dateEnd = (new Date(date.getTime() + 60 * 60 * 1000)).toISOString();
            }
            if (!data.dateStart) {
                // Текущая дата минус 12 часов
                date.setTime(date.getTime() - 12 * 60 * 60 * 1000);
                data.dateStart = date.toISOString().slice(0, 16);
            }
        }
        ctx.body = await monitoringModel.getChartData(data.idTag, data.dateStart, data.dateEnd);
        next();
    };
}