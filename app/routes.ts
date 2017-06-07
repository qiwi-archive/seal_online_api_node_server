import * as Router from 'koa-router';
import * as config from 'config';
import {MonitoringController} from './controllers/monitoring';
import {AuthController} from "./controllers/auth";

const router = new Router();
const monitoringController = new MonitoringController();
const authController = new AuthController();

const baseRoute = config.get('url') + 'online_monitoring/';
const authRoute = config.get('url') + 'public/auth/';

router
    /**
     * @api {get} /online_monitoring/status
     * @apiName getStatus
     * @apiGroup OnlineMonitoring
     *
     * @apiDescription Получаем статус тегов в мониторинге.
     *
     *
     * @apiSuccess {Array} result массив объектов, представляющих теги и их статусы.
     * @apiError {Object} error
     */
    .get(baseRoute + 'status', monitoringController.getStatus)

    /**
     * @api {get} /online_monitoring/chart_data
     * @apiName getChartData
     * @apiGroup OnlineMonitoring
     *
     * @apiDescription Получаем данные для построения графиков по тегу.
     *
     * @apiParam {String} id_tag Идентификатор тега.
     * @apiParam {String} [date_start=(new Date() - 12h] ISO строка даты начала периода.
     * @apiParam {String} [date_end=(new Date() + 1h] ISO строка даты конца периода.
     *
     * @apiSuccess {Array} result массив объектов, представляющих данные для построения графиков.
     * @apiError {Object} error
     */
    .get(baseRoute + 'chart_data', monitoringController.getChartData)

    /**
     * @api {post} /auth/login
     * @apiName login
     * @apiGroup Auth
     *
     * @apiDescription Логинимся (через LDAP)
     *
     * @apiParam {String} login
     * @apiParam {String} password.
     *
     * @apiSuccess {string} result jwt key.
     * @apiError {Object} error
     */
    .post(authRoute + 'login', authController.login);

export {router};