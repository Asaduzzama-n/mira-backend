import express from 'express';
import { MessageController } from './message.controller';
import { MessageValidations } from './message.validation';
import validateRequest from '../../middleware/validateRequest';
import auth from '../../middleware/auth';
import { USER_ROLES } from '../../../enum/user';


const router = express.Router();

router.post(
  '/',
  auth(
    USER_ROLES.USER
  ),
  validateRequest(MessageValidations.create),
  MessageController.sendMessageToRandomUserOptimized
)

router.get(
  '/',
  auth(
    USER_ROLES.USER
  ),
  MessageController.getMyMessages
)

export const MessageRoutes = router;