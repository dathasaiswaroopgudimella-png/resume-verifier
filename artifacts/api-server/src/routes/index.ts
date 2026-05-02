import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import matchRouter from "./match.js";
import datasetRouter from "./dataset.js";
import evaluationRouter from "./evaluation.js";

const router: IRouter = Router();

router.use(healthRouter);
// Match routes: handles POST /match, POST /rank, POST /stability-test
router.use(matchRouter);
router.use(datasetRouter);
router.use(evaluationRouter);

export default router;
