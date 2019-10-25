#!/usr/bin/env node

import { buildTest } from "@qawolf/build-test";
import { buildWorkflow } from "@qawolf/build-workflow";
import { createCheckRun, updateCheckRun } from "@qawolf/github";
import { logger } from "@qawolf/logger";
import { Runner } from "@qawolf/runner";
import { Workflow } from "@qawolf/types";
import program from "commander";
import { outputFile, outputJson, readJson } from "fs-extra";
import { snakeCase } from "lodash";
import { resolve } from "path";
import { runTest } from "./runTest";

program
  .command("build <eventsPath> <name>")
  .description("build a test from events")
  .action(async (eventsPath, name) => {
    const sourcePath = resolve(eventsPath);
    logger.verbose(`read events from ${sourcePath}`);
    const events = await readJson(sourcePath);

    const destPath = `${process.cwd()}/.qawolf`;
    const formattedName = snakeCase(name);
    const destWorkflowPath = `${destPath}/workflows/${formattedName}.json`;
    const destTestPath = `${destPath}/tests/${formattedName}.test.js`;

    logger.verbose(`build workflow -> ${destTestPath}`);
    const workflow = buildWorkflow(events, formattedName);
    await outputJson(destWorkflowPath, workflow, { spaces: " " });

    logger.verbose(`build test -> ${destTestPath}`);
    const test = buildTest(workflow);
    await outputFile(destTestPath, test, "utf8");

    process.exit(0);
  });

program
  .command("run [name]")
  .description("run a workflow")
  .action(async name => {
    const workflowPath = `${process.cwd()}/.qawolf/workflows/${snakeCase(
      name
    )}.json`;
    const workflow = (await readJson(workflowPath)) as Workflow;
    const runner = await Runner.create(workflow);

    await runner.run();
    await runner.close();

    process.exit(0);
  });

program
  .command("test [name]")
  .description("run a test")
  .action(async name => {
    const checkRunId = await createCheckRun();

    const results = await runTest(name ? snakeCase(name) : null);
    const success = results.numFailedTestSuites < 1;

    if (checkRunId) {
      await updateCheckRun(checkRunId, results);
    }

    process.exit(success ? 0 : 1);
  });

program.allowUnknownOption(false);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  console.log("\n");
  program.outputHelp();
}
