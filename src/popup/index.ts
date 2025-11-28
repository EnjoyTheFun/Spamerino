import LocalStore from '../core/LocalStore';
import { PopupApp } from './app/PopupApp';

const store = new LocalStore();
const app = new PopupApp(document, store);

void app.init();
