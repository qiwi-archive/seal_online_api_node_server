import * as config from 'config';

import {router} from './app/routes';
import {App} from "innots";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const app = new App(config, router);