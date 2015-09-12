# v1 used 18 pairs (+1 novel at test) repeated 4 times, with 2.5s per item per trial
# (216 s total study time with 500ms ISI) -- 8 of 18 subjects were at ceiling though (!)

# v2 uses 22 pairs (+1 novel at test) repeated 3 times, with 2.5s per item per trial
# (198 s total study time)
require("ggplot2")

preprocess <- function() {
	instructdat = read.csv("mem_vs_xsl1_instructquiz_data.csv")
	studydat = read.csv("mem_vs_xsl1_study_data.csv")
	testdat = read.csv("mem_vs_xsl1_test_data.csv")
	postqdat = read.csv("mem_vs_xsl1_postquiz_data.csv")
	
	print(paste(length(unique(testdat$uniqueId)), "subjects"))
	# 1, although they didn't do that great...prob just left the default 'yes'
	cheaters = subset(postqdat, memory_aid=="yes")$uniqueId
	print(paste(length(cheaters), "cheaters"))
	# also see if anybody took a ridiculous number of times to do instruct quiz
	# ...yep, same cheater :P

	testdat = subset(testdat, !is.element(uniqueId,cheaters))
	postqdat = subset(postqdat, !is.element(uniqueId,cheaters))
	studydat = subset(studydat, !is.element(uniqueId,cheaters))
	
	testdat$condition = as.character(testdat$condition)
	studydat$condition = as.character(studydat$condition)
	# 1 or 2 pairs per trial:
	testdat$pairs = with(testdat, ifelse(condition=="1pair_shuffle" | condition=="1pair_noshuffle", 1, 2)) 
	studydat$pairs = with(studydat, ifelse(condition=="1pair_shuffle" | condition=="1pair_noshuffle", 1, 2)) 
	# study trials shuffled/not:
	testdat$shuffled = with(testdat, ifelse(condition=="1pair_shuffle" | condition=="2pair_shuffle", "yes", "no")) 
	studydat$shuffled = with(studydat, ifelse(condition=="1pair_shuffle" | condition=="2pair_shuffle", 1, 0)) 
	
	test_Ss = unique(testdat$uniqueId)
	print(paste("Study subjects:",length(unique(studydat$uniqueId)), "Test subjects:",length(test_Ss)))
	studydat = subset(studydat, is.element(uniqueId, test_Ss)) # remove a few who didn't do the test
	
	# add indices of appearance and lag stats
	studydat = process_study_trials(studydat, testdat)
	
	sum(is.na(studydat$correct)) # 48 missing...test trials? can check the words..
	table(studydat[which(is.na(studydat$correct)),]$condition) # 36 missing from one subject (in 2pair_shuffle)
	table(studydat[which(is.na(studydat$correct)),]$uniqueId)
	studydat = subset(studydat, uniqueId!="A3RIBFIB7C8D20:3P529IW9KYLDDSLNARDKSHZ6Y34FLQ")
	testdat = subset(testdat, uniqueId!="A3RIBFIB7C8D20:3P529IW9KYLDDSLNARDKSHZ6Y34FLQ") # only has 6 test trials
	
	return(list(test=testdat, quiz=postqdat, study=studydat))
}


process_study_trials <- function(study, test) {
  study$uniqueId = as.character(study$uniqueId)
  test$uniqueId = as.character(test$uniqueId)
  #require("stringr")
  study$index = as.character(study$index)
  study$ind1 = NA # index 1 
  study$ind2 = NA # first repetition
  study$ind3 = NA # second repetition
  study$studybuddy = NA # only consistent for 2-pair no shuffle condition
  study$correct = NA # grab from test data
  study$response = NA
  for(r in 1:nrow(study)) {
    indstr = unlist(strsplit(study[r,]$index, ", "))
    study[r,]$ind1 = as.numeric(unlist(strsplit(indstr[1],"[[]"))[2])
    study[r,]$ind2 = as.numeric(indstr[2])
    study[r,]$ind3 = as.numeric(unlist(strsplit(indstr[3],"]")))
    select_item = which(test$uniqueId==study[r,]$uniqueId & test$correctAns==study[r,]$obj)
    if(length(select_item)==0) {
      print(study[r,])
    } else {
      study[r,]$correct = test[select_item,]$correct
      study[r,]$response = test[select_item,]$response # check if it's a study budy (or temporally nearby item, even)
    }
  }
  study$lag1 = study$ind2 - study$ind1
  study$lag2 = study$ind3 - study$ind2
  study$mean.lag = (study$lag1 + study$lag2) / 2
  study$lag.var = apply(cbind(study$lag1, study$lag2), 1, var) 
  return(study)
} 


dat = preprocess()
save(dat, file="mem_vs_xsl1_all.RData")
load("mem_vs_xsl1_all.RData")


# 1 novel pair was tested for each subject:
novel = subset(dat$test, studied==0)
mean(novel$correct) # .36 (more likely the more other items you got right?)

scale_cols <- function(dat, cols) {
  for(c in cols) {
    dat[,c] = scale(dat[,c])
  }
  return(dat)
}

log_reg <- function(ee, formula) {
  require(lme4)
  formula = "correct ~ pairs * shuffled * mean.lag * lag.var + (1|uniqueId)"
  print("unscaled:")
  #print(glmer(formula, family=binomial, data=ee))
  print(summary(glmer(formula, family=binomial, data=ee, control=glmerControl(optimizer="bobyqa"))))
  ee_sc = scale_cols(ee, cols=c("mean.lag","lag.var"))
  print("scaled:")
  #print(glmer(formula, family=binomial, data=ee_sc))
  print(summary(glmer(formula, family=binomial, data=ee_sc, control=glmerControl(optimizer="bobyqa"))))
  # with no interactions: mean.lag*** +.17 and lag.var*** -.18
}

log_reg(dat$study)

agg_s = aggregate(cbind(correct, rt) ~ condition + pairs + shuffled + uniqueId, data=dat$test, mean)
hist(agg_s$correct)

bad_RT = subset(agg_s, rt<1000)
bad_acc = subset(agg_s, correct<.06)
bad = rbind(bad_RT, bad_acc)
agg_s = subset(agg_s, !is.element(uniqueId, bad$uniqueId))
print(paste(length(unique(agg_s$uniqueId)),"good subjects"))
summary(aov(correct ~ condition + Error(uniqueId), data=agg_s))
summary(aov(correct ~ pairs + shuffled + Error(uniqueId), data=agg_s))
agg = aggregate(correct ~ pairs + shuffled, data=agg_s, mean)
agg$sd = aggregate(correct ~ pairs + shuffled, data=agg_s, sd)$correct
agg$SE = agg$sd / sqrt(aggregate(correct ~ pairs + shuffled, data=agg_s, length)$correct-1)

test = subset(dat$test, !is.element(uniqueId, bad$uniqueId))
print(summary(glmer("correct ~ pairs + shuffled + (condition|uniqueId)", family=binomial, data=test, control=glmerControl(optimizer="bobyqa"))))


# somehow we're missing one postquiz...
postquiz = dat$quiz[,c("num_correct","uniqueId")]
pagg = subset(agg_s, is.element(agg_s$uniqueId, postquiz$uniqueId))
#postquiz$uniqueId = na.omit(as.character(postquiz$uniqueId))
#pagg$uniqueId = na.omit(as.character(pagg$uniqueId))
postquiz = merge(postquiz, pagg, by=c("uniqueId"))
cor.test(postquiz$num_correct, postquiz$correct) # num they said they got correct vs. actual
# .70 -- they're great at knowing how much they know
pdf("estimated_vs_actualy_correct.pdf", width=4, height=4)
plot(jitter(postquiz$correct), jitter(postquiz$num_correct/18), xlab="Actual Proportion Correct", ylab="Estimated Proportion Correct")
dev.off()
table(agg_s$pairs, agg_s$shuffled)

dodge = position_dodge(width=.3)
limits <- with(agg, aes(ymax=correct+SE, ymin=correct-SE))
ggplot(data=agg, aes(x=as.factor(pairs), y=correct, group=shuffled, colour=shuffled)) + geom_line(position=dodge) + geom_point(position=dodge) + theme_bw() + ylab("Proportion Correct") + xlab("Pairs per Trial") + geom_errorbar(limits, width=.2, position=dodge) 
	ggsave("perf_by_pairs_and_shuffle.pdf", width=4, height=4)

ggplot(agg_s, aes(x=correct, fill=condition)) + geom_density(alpha=.3)
ggsave("density_by_condition.pdf", width=5, height=4)

library(plyr)
cdat <- ddply(agg_s, "condition", summarise, correct.mean=mean(correct))
# Overlaid histograms with means
ggplot(agg_s, aes(x=correct, fill=condition)) + geom_histogram(binwidth=.1, alpha=.3, position="identity") + geom_vline(data=cdat, aes(xintercept=correct.mean, colour=condition), linetype="dashed", size=1)
